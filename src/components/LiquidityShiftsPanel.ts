import type { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';

let _client: MarketServiceClient | null = null;

async function getMarketClient(): Promise<MarketServiceClient> {
  if (!_client) {
    const { MarketServiceClient } = await import('@/generated/client/worldmonitor/market/v1/service_client');
    const { getRpcBaseUrl } = await import('@/services/rpc-client');
    _client = new MarketServiceClient(getRpcBaseUrl(), { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });
  }
  return _client;
}

const TOP_STOCKS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA'];
const COT_PRIORITY = ['CL', 'GC', 'SI', 'ES', 'NQ'];

function toNum(v: string | number): number {
  if (typeof v === 'number') return v;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

function renderShiftPill(value: number): string {
  const sign = value > 0 ? '+' : '';
  const cls = value > 0 ? 'positive' : value < 0 ? 'negative' : '';
  return `<span class="commodity-change ${cls}">${sign}${value.toFixed(2)}%</span>`;
}

function pct(longPos: number, shortPos: number): number {
  const gross = Math.max(longPos + shortPos, 1);
  return ((longPos - shortPos) / gross) * 100;
}

export class LiquidityShiftsPanel extends Panel {
  private _hasData = false;

  constructor() {
    super({
      id: 'liquidity-shifts',
      title: 'Liquidity Shifts',
      showCount: false,
      infoTooltip: 'High-liquidity positioning/shift monitor for oil, gold, silver, equity indices, and top stocks.',
    });
  }

  public async fetchData(): Promise<boolean> {
    this.showLoading();
    try {
      const client = await getMarketClient();
      const [cotResp, stocksResp] = await Promise.all([
        client.getCotPositioning({}),
        client.listMarketQuotes({ symbols: TOP_STOCKS }),
      ]);

      const cotRows = (cotResp.instruments ?? [])
        .filter((i) => COT_PRIORITY.includes(i.code ?? ''))
        .sort((a, b) => COT_PRIORITY.indexOf(a.code ?? '') - COT_PRIORITY.indexOf(b.code ?? ''));

      if (cotRows.length === 0 && (stocksResp.quotes?.length ?? 0) === 0) {
        if (!this._hasData) this.showError('Liquidity data unavailable', () => void this.fetchData());
        return false;
      }

      this._hasData = true;
      const cotHtml = cotRows.map((row) => {
        const longPos = toNum(row.assetManagerLong ?? 0);
        const shortPos = toNum(row.assetManagerShort ?? 0);
        const net = pct(longPos, shortPos);
        const levLong = toNum(row.leveragedFundsLong ?? 0);
        const levShort = toNum(row.leveragedFundsShort ?? 0);
        const levNet = pct(levLong, levShort);
        const label = row.code === 'ES' ? 'S&P 500 futures' : row.code === 'NQ' ? 'Nasdaq futures' : row.name;

        return `<div class="market-item" style="display:block;padding:8px 0">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <div>
              <div class="market-name">${escapeHtml(label ?? row.code ?? '')}</div>
              <div class="market-symbol">${escapeHtml(row.code ?? '')} • Long ${escapeHtml(String(longPos))} / Short ${escapeHtml(String(shortPos))}</div>
            </div>
            <div style="text-align:right">
              <div>${renderShiftPill(net)}</div>
              <div class="market-symbol">Lev ${levNet >= 0 ? '+' : ''}${levNet.toFixed(1)}%</div>
            </div>
          </div>
        </div>`;
      }).join('');

      const stocks = stocksResp.quotes ?? [];
      const stockRows = stocks
        .map((q) => {
          const ch = Number(q.change ?? 0);
          return `<div class="market-item" style="display:flex;justify-content:space-between">
            <div class="market-info"><span class="market-name">${escapeHtml(q.name || q.symbol || '')}</span><span class="market-symbol">${escapeHtml(q.symbol || '')}</span></div>
            <div>${renderShiftPill(ch)}</div>
          </div>`;
        })
        .join('');

      this.setContent(`
        <div style="padding:10px 14px">
          <div style="font-size:11px;font-weight:700;margin-bottom:6px">Oil / Gold / Silver + Index Positioning (COT)</div>
          ${cotHtml || '<div class="market-symbol">No COT rows available.</div>'}
          <div style="font-size:11px;font-weight:700;margin:10px 0 6px">Top Stocks — Daily Shift</div>
          ${stockRows || '<div class="market-symbol">No top stock quotes available.</div>'}
          ${cotResp.reportDate ? `<div class="market-symbol" style="margin-top:8px;text-align:right">COT report date: ${escapeHtml(cotResp.reportDate)}</div>` : ''}
        </div>
      `);
      return true;
    } catch (e) {
      if (!this._hasData) this.showError(e instanceof Error ? e.message : 'Failed to load', () => void this.fetchData());
      return false;
    }
  }
}
