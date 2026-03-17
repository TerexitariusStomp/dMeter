import { Panel } from './Panel';
import type { FredSeries } from '@/services/economic';
import { t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';
import { isDesktopRuntime } from '@/services/runtime';
import { isFeatureAvailable } from '@/services/runtime-config';
import type { SpendingSummary } from '@/services/usa-spending';
import type { BisData } from '@/services/economic';

function formatSeriesValue(series: FredSeries): string {
  if (series.value === null) return 'N/A';
  if (series.unit === '$B') return `$${series.value.toLocaleString()}B`;
  return `${series.value.toLocaleString()}${series.unit}`;
}

function formatSeriesChange(series: FredSeries): string {
  if (series.change === null) return 'No change';
  const sign = series.change > 0 ? '+' : '';
  if (series.unit === '$B') return `${sign}$${Math.abs(series.change).toLocaleString()}B`;
  return `${sign}${series.change.toLocaleString()}${series.unit}`;
}

function getSeriesChangeClass(change: number | null): string {
  if (change === null || change === 0) return 'neutral';
  return change > 0 ? 'positive' : 'negative';
}

function getMacroPressure(data: FredSeries[]): {
  label: string;
  detail: string;
  className: string;
} {
  const byId = new Map(data.map((series) => [series.id, series]));
  const vix = byId.get('VIXCLS')?.value ?? null;
  const curve = byId.get('T10Y2Y')?.value ?? null;
  const unemployment = byId.get('UNRATE')?.value ?? null;
  const fedFunds = byId.get('FEDFUNDS')?.value ?? null;

  let score = 0;
  if (vix !== null) score += vix >= 25 ? 2 : vix >= 18 ? 1 : 0;
  if (curve !== null) score += curve <= 0 ? 2 : curve < 0.5 ? 1 : 0;
  if (unemployment !== null) score += unemployment >= 4.5 ? 1 : 0;
  if (fedFunds !== null) score += fedFunds >= 5 ? 1 : fedFunds <= 2 ? -1 : 0;

  if (score >= 4) {
    return {
      label: t('components.economic.pressure.stress'),
      detail: t('components.economic.pressure.stressDetail'),
      className: 'macro-pressure-stress',
    };
  }
  if (score >= 2) {
    return {
      label: t('components.economic.pressure.watch'),
      detail: t('components.economic.pressure.watchDetail'),
      className: 'macro-pressure-watch',
    };
  }
  return {
    label: t('components.economic.pressure.steady'),
    detail: t('components.economic.pressure.steadyDetail'),
    className: 'macro-pressure-steady',
  };
}

export class EconomicPanel extends Panel {
  private fredData: FredSeries[] = [];
  private lastUpdate: Date | null = null;

  constructor() {
    super({
      id: 'economic',
      title: t('panels.economic'),
      defaultRowSpan: 2,
      infoTooltip: t('components.economic.infoTooltip'),
    });
  }

  public update(data: FredSeries[]): void {
    this.fredData = data;
    this.lastUpdate = new Date();
    this.render();
  }

  public updateSpending(_data: SpendingSummary): void {}

  public updateBis(_data: BisData): void {}

  public setLoading(loading: boolean): void {
    if (loading) this.showLoading();
  }

  private render(): void {
    if (this.fredData.length === 0) {
      if (isDesktopRuntime() && !isFeatureAvailable('economicFred')) {
        this.setContent(`<div class="economic-empty">${t('components.economic.fredKeyMissing')}</div>`);
        return;
      }
      this.setContent(`<div class="economic-empty">${t('components.economic.noIndicatorData')}</div>`);
      return;
    }

    const pressure = getMacroPressure(this.fredData);
    const summaryIds = ['VIXCLS', 'T10Y2Y', 'FEDFUNDS', 'UNRATE'];
    const summarySeries = this.fredData.filter((series) => summaryIds.includes(series.id));
    const detailSeries = this.fredData.filter((series) => !summaryIds.includes(series.id));
    const orderedSeries = [...summarySeries, ...detailSeries];
    const updateTime = this.lastUpdate
      ? this.lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    this.setContent(`
      <div class="economic-content economic-content-macro">
        <div class="macro-pressure-card ${pressure.className}">
          <div class="macro-pressure-label">${t('components.economic.pressure.label')}</div>
          <div class="macro-pressure-value">${escapeHtml(pressure.label)}</div>
          <div class="macro-pressure-detail">${escapeHtml(pressure.detail)}</div>
        </div>
        <div class="macro-summary-grid">
          ${summarySeries.map((series) => `
            <div class="macro-summary-card">
              <div class="macro-summary-head">
                <span class="indicator-name">${escapeHtml(series.name)}</span>
                <span class="indicator-id">${escapeHtml(series.id)}</span>
              </div>
              <div class="macro-summary-value">${escapeHtml(formatSeriesValue(series))}</div>
              <div class="macro-summary-change ${getSeriesChangeClass(series.change)}">${escapeHtml(formatSeriesChange(series))}</div>
            </div>
          `).join('')}
        </div>
        <div class="economic-indicators">
          ${orderedSeries.map((series) => `
            <div class="economic-indicator" data-series="${escapeHtml(series.id)}">
              <div class="indicator-header">
                <span class="indicator-name">${escapeHtml(series.name)}</span>
                <span class="indicator-id">${escapeHtml(series.id)}</span>
              </div>
              <div class="indicator-value">
                <span class="value">${escapeHtml(formatSeriesValue(series))}</span>
                <span class="change ${getSeriesChangeClass(series.change)}">${escapeHtml(formatSeriesChange(series))}</span>
              </div>
              <div class="indicator-date">${escapeHtml(series.date)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="economic-footer">
        <span class="economic-source">FRED • ${updateTime}</span>
      </div>
    `);
  }
}
