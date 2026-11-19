(() => {
  'use strict';
  let fontCSS;
  let downloading = false;

  function openNoteExport() {
    const groups = collectionEntries().filter(group => !group.trashed).map(group => ({
      title: group.title,
      body: group.body,
      notes: orderedCollectionNotes(group.notes).filter(note => ['我的感悟', 'AI精华', '个人提醒', '疑问'].includes(note.type))
        .map(note => ({type: note.type, date: recordDate(note), html: itemContent(note)}))
    })).filter(group => group.notes.length);
    const selected = new Set();
    let filter = 'all';

    function visible(note) {
      return filter === 'all' || (filter === 'own' ? note.type !== 'AI精华' : note.type === 'AI精华');
    }

    function selectedDocument() {
      return groups.map((group, g) => {
        const notes = group.notes.filter((_, n) => selected.has(g + ':' + n));
        if (!notes.length) return '';
        return '<section class="export-question"><h2>' + esc(group.title) + '</h2><div class="export-question-body">' +
          group.body + '</div>' + notes.map(note => '<article class="export-note"><header><b>' +
          esc(note.type) + '</b><time>' + esc(note.date || '日期未知') + '</time></header>' + note.html + '</article>').join('') + '</section>';
      }).join('');
    }

    function updateSelection() {
      const panel = $('#note-export');
      if (!panel) return;
      panel.querySelectorAll('[data-export-note]').forEach(input => { input.checked = selected.has(input.dataset.exportNote); });
      panel.querySelectorAll('[data-export-group]').forEach(input => {
        const group = groups[+input.dataset.exportGroup];
        const keys = group.notes.flatMap((note, n) => visible(note) ? [input.dataset.exportGroup + ':' + n] : []);
        input.checked = keys.every(key => selected.has(key));
        input.indeterminate = !input.checked && keys.some(key => selected.has(key));
      });
      $('#note-export-count').textContent = '已选 ' + selected.size + ' 条';
      $('#note-export-preview').disabled = !selected.size;
    }

    function choose() {
      showDialog('选择导出笔记', '<div id="note-export" class="note-export-workspace"><div class="note-export-tools">' +
        '<label>记录类型 <select id="note-export-filter"><option value="all">全部</option><option value="own">我的感悟与提醒</option><option value="ai">AI 精华</option></select></label>' +
        '<button type="button" class="secondary-button" id="note-export-all">全选当前列表</button>' +
        '<button type="button" class="secondary-button" id="note-export-none">取消全部选择</button></div>' +
        '<div id="note-export-list"></div><footer class="note-export-footer"><span id="note-export-count"></span>' +
        '<button type="button" id="note-export-preview" class="primary-button">预览已选笔记</button></footer></div>');
      const list = $('#note-export-list');
      function renderList() {
        list.innerHTML = groups.map((group, g) => {
          const notes = group.notes.map((note, n) => visible(note) ? '<label class="note-export-option">' +
            '<input type="checkbox" data-export-note="' + g + ':' + n + '"><div><header><b>' + esc(note.type) +
            '</b><time>' + esc(note.date || '日期未知') + '</time></header><div>' + note.html + '</div></div></label>' : '').join('');
          return notes ? '<section class="note-export-group"><label class="note-export-group-title"><input type="checkbox" data-export-group="' +
            g + '"><b>' + esc(group.title) + '</b></label>' + notes + '</section>' : '';
        }).join('') || '<p class="muted">这里暂时没有可导出的记录。</p>';
        updateSelection();
      }
      $('#note-export-filter').value = filter;
      $('#note-export-filter').onchange = event => { filter = event.target.value; renderList(); };
      $('#note-export-all').onclick = () => {
        groups.forEach((group, g) => group.notes.forEach((note, n) => { if (visible(note)) selected.add(g + ':' + n); }));
        updateSelection();
      };
      $('#note-export-none').onclick = () => { selected.clear(); updateSelection(); };
      list.onchange = event => {
        const input = event.target;
        if (input.dataset.exportNote !== undefined) {
          if (input.checked) selected.add(input.dataset.exportNote);
          else selected.delete(input.dataset.exportNote);
        }
        if (input.dataset.exportGroup !== undefined) {
          const g = input.dataset.exportGroup;
          groups[+g].notes.forEach((note, n) => {
            if (!visible(note)) return;
            if (input.checked) selected.add(g + ':' + n);
            else selected.delete(g + ':' + n);
          });
        }
        updateSelection();
      };
      $('#note-export-preview').onclick = preview;
      renderList();
    }

    function preview() {
      const content = selectedDocument();
      showDialog('笔记预览', '<div class="note-export-workspace"><div class="note-export-document">' + content +
        '</div><footer class="note-export-footer"><button type="button" id="note-export-back" class="secondary-button">返回选择</button>' +
        '<span id="note-export-status" role="status"></span><button type="button" id="note-export-download" class="primary-button">导出已选的 ' +
        selected.size + ' 条笔记</button></footer></div>');
      $('#note-export-back').onclick = choose;
      $('#note-export-download').onclick = async () => {
        if (downloading) return;
        downloading = true;
        const button = $('#note-export-download');
        const status = $('#note-export-status');
        button.disabled = true;
        status.textContent = '正在整理公式与字体…';
        try {
          const styles = await offlineStyles();
          const doc = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<title>梵知高数 · 我的学习笔记</title><style>' + styles + '</style></head><body><main class="note-export-document">' +
            '<h1>我的感悟与 AI 精华</h1><p>梵知高数·一步一步 · ' + esc(new Date().toLocaleDateString('zh-CN')) +
            ' · ' + selected.size + ' 条记录</p>' + content + '</main></body></html>';
          const blob = new Blob([doc], {type: 'text/html;charset=utf-8'});
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = '梵知学习笔记-' + new Date().toLocaleDateString('sv-SE') + '.html';
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          status.textContent = '已生成文件，请在下载列表中打开。';
        } catch {
          status.textContent = '导出未完成，请检查网络后重试，已选笔记仍保留。';
        } finally {
          downloading = false;
          button.disabled = false;
        }
      };
    }
    choose();
  }

  async function offlineStyles() {
    if (fontCSS) return fontCSS;
    const styleURL = new URL('vendor/mathlive/mathlive-static.css', location.href);
    const [mathResponse, exportResponse] = await Promise.all([fetch(styleURL), fetch(new URL('note-export.css?v=20261119', location.href))]);
    if (!mathResponse.ok || !exportResponse.ok) throw Error();
    let math = await mathResponse.text();
    const urls = [...new Set([...math.matchAll(/url\(([^)]+)\)/g)].map(match => match[1].replace(/["']/g, '')))];
    const fonts = await Promise.all(urls.map(async path => {
      const response = await fetch(new URL(path, styleURL));
      if (!response.ok) throw Error();
      const buffer = await response.arrayBuffer();
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(new Blob([buffer], {type: 'font/woff2'}));
      });
      return [path, data];
    }));
    for (const [path, data] of fonts) math = math.split(path).join(data);
    fontCSS = math + '\n' + await exportResponse.text();
    return fontCSS;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#open-note-export')) openNoteExport();
  });
})();
