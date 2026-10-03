// Build image slots from the actual document, without relying on a caret or server postId.
export function articleRoot(doc) {
  return doc.querySelector('article') || doc.querySelector('main')
    || doc.querySelector('.bgpt-content, .max-mode-article, .content, [data-orbit-document-body]') || doc.body;
}

export function articleHeadings(doc) {
  const root = articleRoot(doc);
  const eligible = heading => (heading.textContent || '').trim()
    && !heading.closest('nav, aside, footer, [hidden], .toc, .table-of-contents, [data-bgpt-editor]');
  const h2 = [...root.querySelectorAll('h2')].filter(eligible);
  return h2.length ? h2 : [...root.querySelectorAll('h3')].filter(eligible);
}

export function buildEditorImagePlan(doc, scope = 'all') {
  if (!['all', 'odd', 'even', 'thumbnail'].includes(scope)) throw Error('이미지 생성 범위를 다시 선택해 주세요.');
  const root = articleRoot(doc);
  const headings = articleHeadings(doc);
  const plan = [{ kind: 'thumbnail', sectionTitle: '', heading: null, root, ordinal: 0 }];
  if (scope !== 'thumbnail') headings.forEach((heading, index) => {
    const ordinal = index + 1;
    if (scope === 'odd' && ordinal % 2 === 0) return;
    if (scope === 'even' && ordinal % 2 !== 0) return;
    plan.push({ kind: 'section', sectionTitle: heading.textContent.trim(), heading, root, ordinal });
  });
  return plan;
}

function isArticleImage(img) {
  if (img.closest('nav, aside, footer, [hidden], .ad-slot, [data-ad-slot], h1, h2, h3, h4, button')) return false;
  const identity = `${img.getAttribute('alt') || ''} ${img.getAttribute('role') || ''}`;
  if (/프로필|아바타|아이콘|로고|작성자 사진/.test(identity)) return false;
  const decoration = /(?:^|[\s_-])(?:avatar|logo|icon|emoji|badge|author|profile|social|sponsor|advert)(?:$|[\s_-])/i;
  if (decoration.test(identity)) return false;
  for (let node = img; node && !node.matches('article,main,body'); node = node.parentElement) {
    if (decoration.test(`${node.className || ''} ${node.id || ''}`)) return false;
  }
  const width = Number(img.getAttribute('width'));
  const height = Number(img.getAttribute('height'));
  if (width > 0 && height > 0 && width <= 96 && height <= 96) return false;
  return true;
}

function primaryImage(images) {
  return images.find(img => img.hasAttribute('data-orbit-image-role'))
    || images.find(img => img.closest('figure, .separator, .thumbnail, .post-thumbnail, .hero-image, [itemprop="image"]'))
    || images[0] || null;
}

export function thumbnailImage(doc) {
  const root = articleRoot(doc);
  const marked = root.querySelector('img[data-orbit-image-role="thumbnail"]');
  if (marked) return marked;
  const firstHeading = articleHeadings(doc)[0];
  // An image in the first section is not a thumbnail, even if it uses .separator.
  return primaryImage([...root.querySelectorAll('img')].filter(img => isArticleImage(img)
    && (!firstHeading || Boolean(img.compareDocumentPosition(firstHeading) & 4))));
}

function sectionImage(doc, slot) {
  const headings = articleHeadings(doc);
  const next = headings[headings.indexOf(slot.heading) + 1];
  return primaryImage([...slot.root.querySelectorAll('img')].filter(img => img.dataset.orbitImageRole !== 'thumbnail'
    && isArticleImage(img)
    && Boolean(slot.heading.compareDocumentPosition(img) & 4)
    && (!next || Boolean(img.compareDocumentPosition(next) & 4))));
}

export function placeEditorImage(doc, slot, response) {
  if (!slot.root.isConnected || (slot.heading && !slot.heading.isConnected)) throw Error('본문 구조가 바뀌었습니다. 다시 생성 범위를 확인해 주세요.');
  const parsed = doc.createElement('div');
  parsed.innerHTML = String(response.html || '');
  const generated = parsed.querySelector('img');
  const url = String(response.url || generated?.getAttribute('src') || '');
  if (!/^https?:\/\//i.test(url) && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) throw Error('생성된 이미지 주소를 확인하지 못했습니다.');
  if (slot.targetImage && !slot.targetImage.isConnected) throw Error('바꿀 이미지가 본문에서 사라졌습니다.');
  const existing = slot.targetImage || (slot.kind === 'thumbnail' ? thumbnailImage(doc) : sectionImage(doc, slot));
  const image = existing || generated || doc.createElement('img');
  const imageLink = image.closest('a');
  if (imageLink && imageLink.href === image.src) imageLink.setAttribute('href', url);
  image.setAttribute('src', url);
  image.removeAttribute('srcset');
  image.removeAttribute('data-bgpt-user-image');
  image.closest('picture')?.querySelectorAll('source').forEach(source => source.removeAttribute('srcset'));
  image.setAttribute('data-orbit-image-role', slot.kind);
  image.setAttribute('alt', generated?.getAttribute('alt') || slot.sectionTitle || response.alt || '대표 이미지');
  if (!existing) {
    const wrapper = doc.createElement('div');
    wrapper.className = 'separator';
    wrapper.style.cssText = 'clear:both;text-align:center;margin:18px 0;';
    image.style.cssText = 'max-width:100%;height:auto;border-radius:12px;';
    wrapper.append(image);
    if (slot.heading) slot.heading.insertAdjacentElement('afterend', wrapper);
    else slot.root.prepend(wrapper);
  }
  return image;
}
