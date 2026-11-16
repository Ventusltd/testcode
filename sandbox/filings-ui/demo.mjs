// Synthetic local integration fixture. This module does not collect real data.
import {renderFigures} from './render.mjs';

const slot = document.querySelector('#figure-slot');
const selector = document.querySelector('#fixture-case');
const status = document.querySelector('#fixture-status');
const hostClicks = {map: 0, csv: 0};
for (const action of ['map', 'csv']) {
  document.querySelector(`#host-${action}`).addEventListener('click', () => {
    hostClicks[action] += 1;
    document.querySelector('#host-events').textContent = `MAP: ${hostClicks.map} · CSV: ${hostClicks.csv}`;
  });
}

try {
  const response = await fetch('./fixtures.json', {cache: 'no-store'});
  if (!response.ok) throw new Error('Fixture read failed');
  const fixtures = await response.json();
  if (fixtures.schema !== 'testcode.figures-ui.fixtures.v1' || !fixtures.cases?.finance) {
    throw new Error('Unsupported fixture envelope');
  }
  const apply = input => renderFigures(slot, structuredClone(input));
  const showCase = name => {
    if (!Object.hasOwn(fixtures.cases, name)) throw new Error('Unknown fixture case');
    apply(fixtures.cases[name]);
    selector.value = name;
    status.textContent = `Synthetic scenario: ${name}. All populated claims remain provisional.`;
  };
  selector.disabled = false;
  selector.addEventListener('change', () => showCase(selector.value));
  showCase('finance');
  // Explicit harness hook on this synthetic demo only; not a production API.
  window.filingsDemo = {apply, showCase, fixtures: structuredClone(fixtures), hostClicks};
} catch {
  renderFigures(slot, {entityId: 'fixture:unavailable', claims: [], state: 'unavailable'});
  status.textContent = 'Synthetic fixture unavailable. No figures loaded.';
  window.filingsDemoFailure = true;
}
