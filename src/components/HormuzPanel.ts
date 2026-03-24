import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import type { HormuzTrackerData, HormuzChart, HormuzSeries } from '@/services/hormuz-tracker';

const STATUS_CONFIG: Record<string, { label: string; color: string } | undefined> & { open: { label: string; color: string } } = {
  closed:    { label: 'CLOSED',    color: '#e74c3c' },
  disrupted: { label: 'DISRUPTED', color: '#e67e22' },
  restricted:{ label: 'RESTRICTED',color: '#f39c12' },
  open:      { label: 'OPEN',      color: '#2ecc71' },
};

function barChart(series: HormuzSeries[], w = 272, h = 44): string {
  if (!series.length) return '';
  const max = Math.max(...series.map((s) => s.value), 1);
  const bw  = Math.max(1, w / series.length - 0.8);
  const step = w / series.length;

  const bars = series
    .map((s, i) => {
      const bh = s.value > 0 ? Math.max(2, (s.value / max) * (h - 2)) : 1;
      const x  = i * step;
      const y  = h - bh;
      const fill = s.value === 0 ? 'rgba(231,76,60,0.55)' : 'rgba(52,152,219,0.75)';
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${fill}" rx="1"/>`;
    })
    .join('');

  // x-axis date labels — first and last
  const first = series[0]?.date.slice(5) ?? '';   // MM-DD
  const last  = series[series.length - 1]?.date.slice(5) ?? '';
  const axis  = `<text x="0" y="${h + 11}" font-size="8" fill="var(--text-dim)">${escapeHtml(first)}</text>`
              + `<text x="${w}" y="${h + 11}" text-anchor="end" font-size="8" fill="var(--text-dim)">${escapeHtml(last)}</text>`;

  return `<svg width="${w}" height="${h + 14}" viewBox="0 0 ${w} ${h + 14}" xmlns="http://www.w3.org/2000/svg">${bars}${axis}</svg>`;
}

export class HormuzPanel extends Panel {
  constructor() {
    super({
      id: 'hormuz-tracker',
      title: 'Strait of Hormuz',
      infoTooltip: 'Daily shipment volumes through the Strait of Hormuz. Source: WTO DataLab / AXSMarine.',
    });
  }

  public render(data: HormuzTrackerData): void {
    const sc = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.open;

    const chartsHtml = data.charts
      .map((chart: HormuzChart) => {
        const lastVal = chart.series.length ? (chart.series[chart.series.length - 1]?.value ?? null) : null;
        const valStr  = lastVal !== null ? (lastVal === 0 ? '0' : lastVal.toFixed(1)) : '—';
        return `
          <div class="hormuz-chart">
            <div class="hormuz-chart-header">
              <span class="hormuz-chart-title">${escapeHtml(chart.title)}</span>
              <span class="hormuz-chart-val${lastVal === 0 ? ' hormuz-zero' : ''}">${escapeHtml(valStr)}</span>
            </div>
            <div class="hormuz-chart-svg">${barChart(chart.series)}</div>
          </div>
        `;
      })
      .join('');

    const dateStr = data.updatedDate ? `<span class="hormuz-date">WTO update: ${escapeHtml(data.updatedDate)}</span>` : '';

    const html = `
      <div class="hormuz-wrapper">
        <div class="hormuz-header">
          <span class="hormuz-status-badge" style="background:${sc.color}">${sc.label}</span>
          ${dateStr}
        </div>
        ${data.summary ? `<div class="hormuz-summary">${escapeHtml(data.summary.slice(0, 200))}${data.summary.length > 200 ? '…' : ''}</div>` : ''}
        <div class="hormuz-charts">${chartsHtml}</div>
        <div class="hormuz-attribution">
          <a href="${escapeHtml(data.attribution.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(data.attribution.source)}
          </a>
        </div>
      </div>
    `;

    this.setContent(html);
  }
}
