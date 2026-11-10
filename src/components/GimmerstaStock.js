import { createElement } from '../utils/dom.js';
import { fetchGimmerstaStock } from '../services/gimmerstaApi.js';

export default function GimmerstaStock() {
  const view = createElement('div', {
    id: 'gimmerstaStockView',
    class: 'supplier-view hidden',
  });

  const studio = createElement('div', { class: 'supplier-studio' });

  // ── LEFT PANEL
  const leftCard = createElement('div', { class: 'panel supplier-form-panel' });
  const badgeRow = createElement('div', { class: 'supplier-badge-row' });
  badgeRow.innerHTML = `
    <span class="kpi-pill is-ok">Sandberg & Rebel Walls</span>
    <span class="supplier-origin">Gimmersta Sweden · Wallpaper Portal</span>
  `;

  const heading = createElement('h2', { class: 'panel-title' });
  heading.textContent = 'SANDBERG - REBEL WALLS';
  const description = createElement('p', { class: 'panel-copy' });
  description.textContent =
    'Nhập mã sản phẩm (ví dụ 805-21) hoặc đường dẫn chi tiết. Số cuộn hiển thị là mức tối đa của một lô tự chọn.';

  const form = createElement('form', { class: 'field-row', style: 'margin-top: 18px;' });
  const input = createElement('input', {
    type: 'text',
    id: 'gimmerstaProductInput',
    class: 'control-block',
    placeholder: 'Mã sản phẩm (VD: 805-21) hoặc link /products/…',
    autocomplete: 'off',
    'aria-label': 'Mã hoặc link sản phẩm Gimmersta',
  });
  const button = createElement('button', {
    type: 'submit',
    class: 'action-btn action-btn-primary',
  });
  button.textContent = 'Kiểm tra';
  form.append(input, button);

  leftCard.append(badgeRow, heading, description, form);

  // ── RIGHT PANEL
  const rightCard = createElement('div', { class: 'panel supplier-preview-panel' });
  const output = createElement('div', { 'aria-live': 'polite' });

  function renderEmptyPreview() {
    output.replaceChildren();
    output.className = 'empty-state';
    output.style.minHeight = '220px';
    output.innerHTML = `
      <div class="state-icon-circle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M4 9h16M9 9v11" stroke="currentColor" stroke-width="1.5"/></svg>
      </div>
      <h2>Tra cứu tồn cuộn Gimmersta</h2>
      <p>Nhập mã giấy dán tường Sandberg hoặc Rebel Walls để kiểm tra số cuộn theo từng lô sản xuất.</p>
    `;
  }

  renderEmptyPreview();
  rightCard.appendChild(output);
  studio.append(leftCard, rightCard);
  view.appendChild(studio);

  let requestId = 0;

  function line(label, value) {
    const p = createElement('p', { class: 'panel-copy' });
    const strong = createElement('strong');
    strong.textContent = `${label}: `;
    p.append(strong, document.createTextNode(String(value)));
    return p;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const product = input.value.trim();
    const id = ++requestId;
    output.replaceChildren();
    output.className = '';
    output.style.minHeight = '';
    if (!product) {
      output.className = 'alert alert-error';
      output.textContent = 'Vui lòng nhập mã hoặc link sản phẩm.';
      return;
    }
    input.disabled = true;
    button.disabled = true;
    button.textContent = 'Đang tra cứu…';
    try {
      const data = await fetchGimmerstaStock(product);
      if (id !== requestId) return;
      const title = createElement('h3', { class: 'panel-title', style: 'font-size: 17px; margin-bottom: 12px;' });
      title.textContent = `${data.article} — ${data.name}`;
      output.appendChild(title);
      if (data.imageUrl?.startsWith('https://res.cloudinary.com/gimmersta-wallpaper/')) {
        const image = createElement('img', {
          class: 'product-shot',
          src: data.imageUrl,
          alt: `Hình ảnh sản phẩm Gimmersta ${data.article} — ${data.name}`,
          loading: 'lazy',
        });
        image.addEventListener('error', () => image.remove(), { once: true });
        output.appendChild(image);
      }
      if (data.collection) output.appendChild(line('Bộ sưu tập', data.collection));
      if (data.status === 'in_stock') {
        const okCard = createElement('div', { class: 'result-card is-ok', style: 'margin-top: 12px;' });
        okCard.appendChild(line('Tồn tối đa theo lô tự chọn', `${data.rolls} Roll`));
        for (const item of data.batches || []) {
          okCard.appendChild(
            line(`Lô ${item.batch}`, item.rolls === null ? 'Không rõ số cuộn' : `${item.rolls} Roll`)
          );
        }
        output.appendChild(okCard);
      } else if (data.status === 'on_demand') {
        const productionMessage = data.productionMessage?.trim();
        const infoCard = createElement('div', { class: 'result-card', style: 'margin-top: 12px;' });
        infoCard.appendChild(
          line(
            'Trạng thái',
            /^Produced on demand in 2-3 days$/i.test(productionMessage || '')
              ? 'Sản xuất theo yêu cầu trong 2–3 ngày'
              : productionMessage || 'Sản xuất theo yêu cầu'
          )
        );
        infoCard.appendChild(
          line('Lưu ý', 'Sản xuất theo yêu cầu; không có số cuộn tồn kho để cam kết giao ngay.')
        );
        output.appendChild(infoCard);
      }
      const link = createElement('a', {
        href: data.productUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'action-btn',
        style: 'display: inline-flex; align-items: center; margin-top: 14px; text-decoration: none;',
      });
      link.textContent = 'Mở trang sản phẩm trên Gimmersta ↗';
      output.appendChild(link);
    } catch (error) {
      if (id === requestId) {
        output.className = 'alert alert-error';
        output.textContent = error.message;
      }
    } finally {
      if (id === requestId) {
        input.disabled = false;
        button.disabled = false;
        button.textContent = 'Kiểm tra';
      }
    }
  });
  return view;
}
