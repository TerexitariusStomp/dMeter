import { Panel } from './Panel';
import type { RadiationObservation } from '@/services/radiation';
import { escapeHtml } from '@/utils/sanitize';

export class RadiationWatchPanel extends Panel {
  private observations: RadiationObservation[] = [];
  private fetchedAt: Date | null = null;
  private onLocationClick?: (lat: number, lon: number) => void;

  constructor() {
    super({
      id: 'radiation-watch',
      title: 'Radiation Watch (US)',
      showCount: true,
      trackActivity: true,
      infoTooltip: 'EPA RadNet gamma readings from 10 US cities. Phase 1 coverage; community sensors can expand this later.',
    });
    this.showLoading('Loading radiation data...');

    this.content.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('.radiation-row');
      if (!row) return;
      const lat = Number(row.dataset.lat);
      const lon = Number(row.dataset.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) this.onLocationClick?.(lat, lon);
    });
  }

  public setLocationClickHandler(handler: (lat: number, lon: number) => void): void {
    this.onLocationClick = handler;
  }

  public setData(observations: RadiationObservation[], fetchedAt: Date): void {
    this.observations = observations;
    this.fetchedAt = fetchedAt;
    this.setCount(observations.length);
    this.render();
  }

  private render(): void {
    if (this.observations.length === 0) {
      this.setContent('<div class="panel-empty">No radiation observations available.</div>');
      return;
    }

    const rows = this.observations.map((obs) => {
      const observed = formatObservedAt(obs.observedAt);
      const reading = formatReading(obs.value, obs.unit);
      return `
        <tr class="radiation-row" data-lat="${obs.lat}" data-lon="${obs.lon}">
          <td class="radiation-location">${escapeHtml(obs.location)}</td>
          <td><span class="radiation-source">${escapeHtml(obs.source)}</span></td>
          <td class="radiation-reading">${escapeHtml(reading)}</td>
          <td><span class="radiation-freshness radiation-freshness-${obs.freshness}">${escapeHtml(obs.freshness)}</span></td>
          <td class="radiation-observed">${escapeHtml(observed)}</td>
        </tr>
      `;
    }).join('');

    const footer = this.fetchedAt
      ? `Updated ${this.fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';

    this.setContent(`
      <div class="radiation-panel-content">
        <table class="radiation-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Source</th>
              <th>Reading</th>
              <th>Freshness</th>
              <th>Observed</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="radiation-footer">${escapeHtml(footer)}</div>
      </div>
    `);

  }
}

function formatReading(value: number, unit: string): string {
  const precision = unit === 'nSv/h' ? 1 : 0;
  return `${value.toFixed(precision)} ${unit}`;
}

function formatObservedAt(date: Date): string {
  const ageMs = Date.now() - date.getTime();
  if (ageMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(ageMs / (60 * 60 * 1000)));
    return `${hours}h ago`;
  }
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (days < 30) return `${days}d ago`;
  return date.toISOString().slice(0, 10);
}
