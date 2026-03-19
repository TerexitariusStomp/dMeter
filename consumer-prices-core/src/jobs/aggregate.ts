/**
 * Aggregate job: computes basket indices from latest price observations.
 * Produces Fixed Basket Index and Value Basket Index per methodology.
 */
import { query } from '../db/client.js';
import { loadAllBasketConfigs } from '../config/loader.js';

const logger = {
  info: (msg: string, ...args: unknown[]) => console.log(`[aggregate] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[aggregate] ${msg}`, ...args),
};

interface BasketRow {
  basketItemId: string;
  category: string;
  weight: number;
  retailerProductId: string;
  retailerSlug: string;
  price: number;
  unitPrice: number | null;
  currencyCode: string;
  observedAt: Date;
}

interface CategoryFloor {
  category: string;
  weight: number;
  floorPrice: number;
  retailerSlug: string;
}

interface BasketIndexResult {
  date: Date;
  essentialsIndex: number;
  valueIndex: number;
  retailerBreakdown: Record<string, number>;
  categoryBreakdown: Array<{ category: string; contribution: number; wowPct: number | null; momPct: number | null }>;
  coveragePct: number;
  coverageCount: number;
  totalItems: number;
}

async function getBasketRows(basketSlug: string, marketCode: string): Promise<BasketRow[]> {
  const result = await query<{
    basket_item_id: string;
    category: string;
    weight: string;
    retailer_product_id: string;
    retailer_slug: string;
    price: string;
    unit_price: string | null;
    currency_code: string;
    observed_at: Date;
  }>(
    `SELECT bi.id AS basket_item_id,
            bi.category,
            bi.weight,
            rp.id AS retailer_product_id,
            r.slug AS retailer_slug,
            po.price,
            po.unit_price,
            po.currency_code,
            po.observed_at
     FROM baskets b
     JOIN basket_items bi ON bi.basket_id = b.id AND bi.active = true
     JOIN product_matches pm ON pm.basket_item_id = bi.id AND pm.match_status IN ('auto','approved')
     JOIN retailer_products rp ON rp.id = pm.retailer_product_id AND rp.active = true
     JOIN retailers r ON r.id = rp.retailer_id AND r.market_code = $2 AND r.active = true
     JOIN LATERAL (
       SELECT price, unit_price, currency_code, observed_at
       FROM price_observations
       WHERE retailer_product_id = rp.id AND in_stock = true
       ORDER BY observed_at DESC LIMIT 1
     ) po ON true
     WHERE b.slug = $1`,
    [basketSlug, marketCode],
  );

  return result.rows.map((r) => ({
    basketItemId: r.basket_item_id,
    category: r.category,
    weight: parseFloat(r.weight),
    retailerProductId: r.retailer_product_id,
    retailerSlug: r.retailer_slug,
    price: parseFloat(r.price),
    unitPrice: r.unit_price ? parseFloat(r.unit_price) : null,
    currencyCode: r.currency_code,
    observedAt: r.observed_at,
  }));
}

async function getBaselinePrice(basketItemId: string, baseDate: string): Promise<number | null> {
  const result = await query<{ price: string }>(
    `SELECT AVG(po.price)::numeric(12,2) AS price
     FROM price_observations po
     JOIN product_matches pm ON pm.retailer_product_id = po.retailer_product_id
     WHERE pm.basket_item_id = $1
       AND po.in_stock = true
       AND DATE_TRUNC('day', po.observed_at) = $2::date`,
    [basketItemId, baseDate],
  );
  const p = result.rows[0]?.price;
  return p ? parseFloat(p) : null;
}

function computeFixedIndex(rows: BasketRow[], baselines: Map<string, number>): number {
  let weightedSum = 0;
  let totalWeight = 0;

  const byItem = new Map<string, BasketRow[]>();
  for (const r of rows) {
    if (!byItem.has(r.basketItemId)) byItem.set(r.basketItemId, []);
    byItem.get(r.basketItemId)!.push(r);
  }

  for (const [itemId, itemRows] of byItem) {
    const base = baselines.get(itemId);
    if (!base) continue;

    const avgPrice = itemRows.reduce((s, r) => s + r.price, 0) / itemRows.length;
    const weight = itemRows[0].weight;

    weightedSum += weight * (avgPrice / base);
    totalWeight += weight;
  }

  if (totalWeight === 0) return 100;
  return 100 * (weightedSum / totalWeight);
}

function computeValueIndex(rows: BasketRow[], baselines: Map<string, number>): number {
  const byCategory = new Map<string, BasketRow[]>();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }

  const floors: CategoryFloor[] = [];
  for (const [cat, catRows] of byCategory) {
    const sorted = [...catRows].sort((a, b) => a.price - b.price);
    const cheapest = sorted.slice(0, 3);
    const floorPrice = cheapest.reduce((s, r) => s + r.price, 0) / cheapest.length;
    floors.push({ category: cat, weight: catRows[0].weight, floorPrice, retailerSlug: cheapest[0].retailerSlug });
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const floor of floors) {
    const base = [...baselines.values()][0];
    if (!base) continue;
    weightedSum += floor.weight * (floor.floorPrice / base);
    totalWeight += floor.weight;
  }

  if (totalWeight === 0) return 100;
  return 100 * (weightedSum / totalWeight);
}

async function writeComputedIndex(
  basketId: string,
  retailerId: string | null,
  category: string | null,
  metricKey: string,
  metricValue: number,
) {
  await query(
    `INSERT INTO computed_indices (basket_id, retailer_id, category, metric_date, metric_key, metric_value, methodology_version)
     VALUES ($1,$2,$3,NOW()::date,$4,$5,'1')
     ON CONFLICT (basket_id, retailer_id, category, metric_date, metric_key)
     DO UPDATE SET metric_value = EXCLUDED.metric_value, methodology_version = EXCLUDED.methodology_version`,
    [basketId, retailerId, category, metricKey, metricValue],
  );
}

export async function aggregateBasket(basketSlug: string, marketCode: string) {
  const configs = loadAllBasketConfigs();
  const basketConfig = configs.find((b) => b.slug === basketSlug && b.marketCode === marketCode);
  if (!basketConfig) {
    logger.warn(`Basket ${basketSlug}:${marketCode} not found in config`);
    return;
  }

  const basketResult = await query<{ id: string }>(`SELECT id FROM baskets WHERE slug = $1`, [basketSlug]);
  if (!basketResult.rows.length) {
    logger.warn(`Basket ${basketSlug} not found in DB — run seed first`);
    return;
  }
  const basketId = basketResult.rows[0].id;

  const rows = await getBasketRows(basketSlug, marketCode);
  if (rows.length === 0) {
    logger.warn(`No matched products for ${basketSlug}:${marketCode}`);
    return;
  }

  const baselines = new Map<string, number>();
  for (const itemId of new Set(rows.map((r) => r.basketItemId))) {
    const base = await getBaselinePrice(itemId, basketConfig.baseDate);
    if (base) baselines.set(itemId, base);
  }

  const essentialsIndex = computeFixedIndex(rows, baselines);
  const valueIndex = computeValueIndex(rows, baselines);

  const coverageCount = new Set(rows.map((r) => r.basketItemId)).size;
  const totalItems = basketConfig.items.length;
  const coveragePct = (coverageCount / totalItems) * 100;

  await writeComputedIndex(basketId, null, null, 'essentials_index', essentialsIndex);
  await writeComputedIndex(basketId, null, null, 'value_index', valueIndex);
  await writeComputedIndex(basketId, null, null, 'coverage_pct', coveragePct);

  logger.info(`${basketSlug}:${marketCode} essentials=${essentialsIndex.toFixed(2)} value=${valueIndex.toFixed(2)} coverage=${coveragePct.toFixed(1)}%`);
}

export async function aggregateAll() {
  const configs = loadAllBasketConfigs();
  for (const c of configs) {
    await aggregateBasket(c.slug, c.marketCode);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  aggregateAll().catch(console.error);
}
