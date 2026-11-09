import { createElement } from '../utils/dom.js';
import { fetchGimmerstaStock } from '../services/gimmerstaApi.js';

export default function GimmerstaStock() {
  const view = createElement('div', {
    id: 'gimmerstaStockView',
    class: 'hidden max-w-3xl mx-auto py-4 px-2 sm:px-4',
  });
  const card = createElement('div', { class: 'bg-white rounded-xl border p-5 sm:p-6 shadow-sm' });
  card.style.borderColor = '#e8ddd4';
  const heading = createElement('h2', { class: 'text-lg font-bold mb-1' });
  heading.textContent = 'Tra cứu tồn kho SANDBERG - REBEL WALLS';
  const description = createElement('p', { class: 'text-sm mb-5' });
  description.style.color = '#6b5a45';
  description.textContent =
    'Nhập mã sản phẩm (ví dụ: 805-21) hoặc link chi tiết sản phẩm Gimmersta. Số cuộn là mức tối đa của một lô tự chọn, không phải tổng nhiều lô.';
  const form = createElement('form', { class: 'flex flex-col sm:flex-row gap-2 mb-4' });
  const input = createElement('input', {
    type: 'text',
    id: 'gimmerstaProductInput',
    class: 'flex-1 rounded-lg border px-3 py-2',
    placeholder: 'Mã sản phẩm hoặc link /products/…',
    autocomplete: 'off',
    'aria-label': 'Mã hoặc link sản phẩm Gimmersta',
  });
  input.style.borderColor = '#d4c4b0';
  const button = createElement('button', {
    type: 'submit',
    class: 'rounded-lg px-4 py-2 text-white font-semibold',
  });
  button.style.background = '#6b5a45';
  button.textContent = 'Kiểm tra tồn kho';
  const output = createElement('div', { 'aria-live': 'polite' });
  form.append(input, button);
  card.append(heading, description, form, output);
  view.appendChild(card);
  let requestId = 0;

  function line(label, value) {
    const p = createElement('p', { class: 'text-sm mt-2' });
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
    output.style.color = '';
    if (!product) {
      output.textContent = 'Vui lòng nhập mã hoặc link sản phẩm.';
      return;
    }
    input.disabled = true;
    button.disabled = true;
    button.textContent = 'Đang tra cứu…';
    try {
      const data = await fetchGimmerstaStock(product);
      if (id !== requestId) return;
      const title = createElement('h3', { class: 'font-bold text-base mb-2' });
      title.textContent = `${data.article} — ${data.name}`;
      output.appendChild(title);
      if (data.imageUrl?.startsWith('https://res.cloudinary.com/gimmersta-wallpaper/')) {
        const imageWrap = createElement('div', {
          style: 'display:flex; justify-content:center; margin:12px 0 18px;',
        });
        const image = createElement('img', {
          src: data.imageUrl,
          alt: `Hình ảnh sản phẩm Gimmersta ${data.article} — ${data.name}`,
          loading: 'lazy',
        });
        image.style.cssText =
          'display:block; width:min(100%, 360px); max-height:360px; object-fit:contain; border-radius:12px; border:1px solid #e2d6ca; box-shadow:0 6px 18px rgba(42,35,31,0.12); background:#f8f5f1;';
        image.addEventListener('error', () => imageWrap.remove(), { once: true });
        imageWrap.appendChild(image);
        output.appendChild(imageWrap);
      }
      if (data.collection) output.appendChild(line('Bộ sưu tập', data.collection));
      if (data.status === 'in_stock') {
        const stock = line('Tồn tối đa theo lô tự chọn', `${data.rolls} Roll`);
        stock.style.color = '#166534';
        output.appendChild(stock);
        if (data.batches?.length) {
          for (const item of data.batches)
            output.appendChild(
              line(
                `Lô ${item.batch}`,
                item.rolls === null ? 'Không rõ số cuộn' : `${item.rolls} Roll`
              )
            );
        }
      } else if (data.status === 'on_demand') {
        const productionMessage = data.productionMessage?.trim();
        output.appendChild(
          line(
            'Trạng thái',
            /^Produced on demand in 2-3 days$/i.test(productionMessage || '')
              ? 'Sản xuất theo yêu cầu trong 2–3 ngày'
              : productionMessage || 'Sản xuất theo yêu cầu'
          )
        );
        output.appendChild(
          line('Lưu ý', 'Sản xuất theo yêu cầu; không có số cuộn tồn kho để cam kết giao ngay.')
        );
      }
      const link = createElement('a', {
        href: data.productUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'inline-block mt-3 underline text-sm',
      });
      link.textContent = 'Xem trên Gimmersta';
      output.appendChild(link);
    } catch (error) {
      if (id === requestId) {
        output.textContent = error.message;
        output.style.color = '#b91c1c';
      }
    } finally {
      if (id === requestId) {
        input.disabled = false;
        button.disabled = false;
        button.textContent = 'Kiểm tra tồn kho';
      }
    }
  });
  return view;
}
