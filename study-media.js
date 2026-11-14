(() => {
  'use strict';

  const composer = $('#compose-editor');
  const voiceStatus = $('#study-media-status');
  const voiceButton = $('#study-voice');
  const messages = $('#chat-messages');
  let recording;
  let playback;

  function showMediaError(element, error) {
    element.textContent = error.message || '本次操作未完成，请重试。';
  }

  function makeWave(samples) {
    const size = samples.reduce((total, block) => total + block.length, 0);
    const wave = new DataView(new ArrayBuffer(44 + size * 2));
    const label = (start, name) => [...name].forEach((letter, i) => wave.setUint8(start + i, letter.charCodeAt(0)));
    label(0, 'RIFF');
    wave.setUint32(4, 36 + size * 2, true);
    label(8, 'WAVE');
    label(12, 'fmt ');
    wave.setUint32(16, 16, true);
    wave.setUint16(20, 1, true);
    wave.setUint16(22, 1, true);
    wave.setUint32(24, 16000, true);
    wave.setUint32(28, 32000, true);
    wave.setUint16(32, 2, true);
    wave.setUint16(34, 16, true);
    label(36, 'data');
    wave.setUint32(40, size * 2, true);
    let offset = 44;
    for (const block of samples) {
      for (const value of block) {
        wave.setInt16(offset, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
        offset += 2;
      }
    }
    return new Blob([wave], {type: 'audio/wav'});
  }

  function resetRecording(current) {
    clearTimeout(current.timer);
    current.stream?.getTracks().forEach(track => track.stop());
    current.context?.close().catch(() => {});
    current.context = null;
    current.stream = null;
  }

  function finishRecording(current, cancel = false) {
    resetRecording(current);
    if (recording !== current) return;
    if (cancel) {
      current.controller.abort();
      recording = null;
      voiceButton.textContent = '语音输入';
      voiceStatus.textContent = '';
      return;
    }
    if (current.phase !== 'recording') return;
    current.phase = 'transcribing';
    voiceButton.textContent = '取消转写';
    voiceStatus.textContent = '正在转写…';
    transcribe(current);
  }

  async function transcribe(current) {
    try {
      if (current.samples.length < 3) throw Error('录音太短，请再说一次。');
      const form = new FormData();
      form.append('file', makeWave(current.samples), 'question.wav');
      const result = await studyAI.media('asr', form, current.controller.signal);
      if (recording !== current || questions[state.q]?.id !== current.questionId) return;
      const transcript = result.text?.trim();
      if (!transcript) throw Error('没有识别到清楚的语音，请重试。');
      const parts = serializeEditor(composer);
      if (partsText(parts).trim()) parts.push({type: 'text', text: '\n'});
      parts.push({type: 'text', text: transcript});
      setEditor(composer, parts);
      syncEditor(composer);
      voiceStatus.textContent = '已填入转写文字，可编辑后发送。';
    } catch (error) {
      if (recording === current) showMediaError(voiceStatus, error);
    } finally {
      if (recording === current) {
        recording = null;
        voiceButton.textContent = '语音输入';
      }
    }
  }

  voiceButton.onclick = async () => {
    if (recording) {
      finishRecording(recording, recording.phase !== 'recording');
      return;
    }
    if (busy) return;
    if (!aiStatus.configured) {
      voiceStatus.textContent = '请先在齿轮中连接 DeepSeek。';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      voiceStatus.textContent = '当前浏览器无法录音，请试试手机系统浏览器。';
      return;
    }
    stopPlayback();
    const current = {
      phase: 'permission',
      questionId: questions[state.q].id,
      samples: [],
      controller: new AbortController()
    };
    recording = current;
    voiceButton.textContent = '取消录音';
    voiceStatus.textContent = '等待麦克风权限…';
    try {
      current.context = new AudioContext({sampleRate: 16000});
      if (current.context.sampleRate !== 16000) throw Error('当前浏览器无法以所需格式录音，请试试系统浏览器。');
      await current.context.resume();
      if (recording !== current) return;
      current.stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1}});
      if (recording !== current) {
        resetRecording(current);
        return;
      }
      const context = current.context;
      const source = context.createMediaStreamSource(current.stream);
      if (!context.audioWorklet) throw Error('当前浏览器不支持录音，请试试手机系统浏览器。');
      await context.audioWorklet.addModule(new URL('study-microphone.js?v=20261114', location.href));
      if (recording !== current) return;
      const capture = new AudioWorkletNode(context, 'study-microphone');
      capture.port.onmessage = ({data}) => {
        if (recording === current && current.phase === 'recording') current.samples.push(data);
      };
      current.phase = 'recording';
      source.connect(capture).connect(context.destination);
      voiceButton.textContent = '停止录音';
      voiceStatus.textContent = '录音中，最长 60 秒。';
      current.timer = setTimeout(() => finishRecording(current), 60000);
    } catch (error) {
      if (recording !== current) return;
      finishRecording(current, true);
      voiceStatus.textContent = error.name === 'NotAllowedError' ? '麦克风权限未开启，可在浏览器中允许后重试。' :
        error.name === 'NotFoundError' ? '没有检测到麦克风。' : error.message || '无法开启麦克风。';
    }
  };

  function stopPlayback() {
    const current = playback;
    if (!current) return;
    playback = null;
    current.controller.abort();
    current.audio?.pause();
    if (current.url) URL.revokeObjectURL(current.url);
    current.button.onclick = null;
    current.button.textContent = '朗读';
  }

  messages.addEventListener('click', async event => {
    const button = event.target.closest('[data-study-read]');
    if (!button) return;
    if (playback?.button === button) {
      stopPlayback();
      return;
    }
    if (!aiStatus.configured) {
      toast('请先在齿轮中连接 DeepSeek。');
      return;
    }
    stopPlayback();
    if (recording) finishRecording(recording, true);
    const body = button.closest('.chat-message').querySelector('.message-body').cloneNode(true);
    body.querySelectorAll('.rendered-math').forEach(math => {
      math.replaceWith(document.createTextNode(' ' + math.dataset.sourceLatex + ' '));
    });
    const text = body.textContent.trim();
    if (!text) return;
    const current = {button, controller: new AbortController()};
    playback = current;
    button.textContent = '取消朗读';
    try {
      const blob = await studyAI.media('tts', {text: text.slice(0, 4800), voice_id: 'stella', format: 'wav'}, current.controller.signal);
      if (playback !== current || !button.isConnected) return;
      current.url = URL.createObjectURL(blob);
      current.audio = new Audio(current.url);
      current.audio.onended = stopPlayback;
      current.audio.onerror = () => {
        if (playback !== current) return;
        stopPlayback();
        toast('音频未能播放，请重试。');
      };
      await current.audio.play();
      if (playback === current) button.textContent = '停止朗读';
    } catch (error) {
      if (playback !== current) return;
      if (error.name === 'NotAllowedError' && current.audio) {
        button.textContent = '播放朗读';
        button.onclick = async event => {
          event.stopPropagation();
          button.onclick = null;
          try {
            await current.audio.play();
            if (playback === current) button.textContent = '停止朗读';
          } catch {
            if (playback === current) stopPlayback();
            toast('音频未能播放，请重试。');
          }
        };
        return;
      }
      stopPlayback();
      toast(error.message || '未能生成朗读，请重试。');
    }
  });

  const chatWindow = $('#chat-window');
  new MutationObserver(() => {
    if (!chatOpen) {
      if (recording) finishRecording(recording, true);
      stopPlayback();
    }
    if (playback && !playback.button.isConnected) stopPlayback();
    if (recording && (questions[state.q]?.id !== recording.questionId || busy)) finishRecording(recording, true);
  }).observe(chatWindow, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden', 'disabled']});

  function mountCrop(canvas, bitmap) {
    const ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    let start, end;
    const rectangle = () => start && end && Math.abs(end.x - start.x) > 8 && Math.abs(end.y - start.y) > 8 ?
      [Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y)] :
      [0, 0, canvas.width, canvas.height];
    const point = event => {
      const box = canvas.getBoundingClientRect();
      return {
        x: Math.round(Math.max(0, Math.min(canvas.width, (event.clientX - box.left) * canvas.width / box.width))),
        y: Math.round(Math.max(0, Math.min(canvas.height, (event.clientY - box.top) * canvas.height / box.height)))
      };
    };
    const draw = () => {
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (!start || !end) return;
      const [x, y, width, height] = rectangle();
      context.strokeStyle = '#6a38cf';
      context.lineWidth = Math.max(2, canvas.width / 200);
      context.strokeRect(x, y, width, height);
    };
    let pointer;
    canvas.onpointerdown = event => {
      if (!event.isPrimary) return;
      canvas.setPointerCapture(event.pointerId);
      pointer = event.pointerId;
      start = point(event);
      end = null;
      draw();
    };
    canvas.onpointermove = event => {
      if (pointer !== event.pointerId) return;
      end = point(event);
      draw();
    };
    canvas.onpointerup = event => {
      if (pointer !== event.pointerId) return;
      end = point(event);
      pointer = null;
      draw();
    };
    canvas.onpointercancel = () => { pointer = null; };
    draw();
    return {
      reset() { start = end = null; draw(); },
      image() {
        const [x, y, width, height] = rectangle();
        const crop = document.createElement('canvas');
        crop.width = width;
        crop.height = height;
        const scaleX = bitmap.width / canvas.width;
        const scaleY = bitmap.height / canvas.height;
        crop.getContext('2d').drawImage(bitmap, x * scaleX, y * scaleY, width * scaleX, height * scaleY, 0, 0, width, height);
        return crop.toDataURL('image/jpeg', .92);
      }
    };
  }

  function openPhoto() {
    if (busy) { toast('请等当前回复完成后再录题。'); return; }
    showDialog('拍照录题', '<div class="study-media-photo"><div class="study-media-actions">' +
      '<button class="secondary-button" id="study-take-photo" type="button">拍一张</button>' +
      '<button class="secondary-button" id="study-pick-photo" type="button">选照片</button></div>' +
      '<input id="study-camera-file" type="file" accept="image/*" capture="environment" hidden>' +
      '<input id="study-photo-file" type="file" accept="image/*" hidden>' +
      '<p class="muted study-crop-help" hidden>拖出一道题的范围，也可以使用整张照片。</p>' +
      '<div class="study-crop" hidden><canvas aria-label="拖动选取单题区域"></canvas></div>' +
      '<p class="study-media-status" role="status"></p><div class="study-media-actions">' +
      '<button class="secondary-button" id="study-whole-photo" type="button" hidden>使用整张照片</button>' +
      '<button class="primary-button" id="study-read-photo" type="button" disabled>识别题目</button></div></div>');
    const panel = $('.study-media-photo');
    const status = panel.querySelector('[role=status]');
    const recognize = $('#study-read-photo');
    const whole = $('#study-whole-photo');
    const area = panel.querySelector('.study-crop');
    const controller = new AbortController();
    const active = () => panel.isConnected && !$('#dialog-overlay').hidden;
    let crop, imageVersion = 0;
    const cleanup = new MutationObserver(() => {
      if (active()) return;
      controller.abort();
      cleanup.disconnect();
    });
    cleanup.observe($('#dialog-overlay'), {attributes: true, childList: true, subtree: true, attributeFilter: ['hidden']});
    $('#study-take-photo').onclick = () => $('#study-camera-file').click();
    $('#study-pick-photo').onclick = () => $('#study-photo-file').click();
    for (const input of panel.querySelectorAll('input')) input.onchange = async () => {
      const file = input.files[0];
      input.value = '';
      if (!file || recognize.dataset.pending) return;
      const version = ++imageVersion;
      crop = null;
      recognize.disabled = true;
      area.hidden = whole.hidden = panel.querySelector('.study-crop-help').hidden = true;
      status.textContent = '';
      const url = URL.createObjectURL(file);
      const bitmap = new Image();
      try {
        bitmap.src = url;
        await bitmap.decode();
        if (!active() || imageVersion !== version) return;
        crop = mountCrop(area.querySelector('canvas'), bitmap);
        area.hidden = whole.hidden = panel.querySelector('.study-crop-help').hidden = false;
        recognize.disabled = false;
      } catch {
        if (active() && imageVersion === version) status.textContent = '这张照片无法读取，请使用 JPG、PNG 或手机截图。';
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    whole.onclick = () => crop?.reset();
    recognize.onclick = async () => {
      if (!crop || recognize.dataset.pending) return;
      if (!aiStatus.configured) {
        status.textContent = '请先在私教齿轮中连接 DeepSeek，再回来识别。';
        return;
      }
      recognize.dataset.pending = '1';
      const buttons = [...panel.querySelectorAll('button')];
      buttons.forEach(button => { button.disabled = true; });
      status.textContent = '正在识别，请保留此窗口…';
      const photo = crop.image();
      try {
        const result = await studyAI.media('photo', {photo}, controller.signal);
        if (!active()) return;
        const reply = result?.choices?.[0]?.message;
        if (reply?.refusal || result?.choices?.[0]?.finish_reason === 'content_filter') throw Error('这张照片未通过审核，请更换后重试。');
        if (result?.choices?.[0]?.finish_reason === 'length') throw Error('题面没有识别完整，请裁得更小后重试。');
        const parsed = JSON.parse(reply?.content || 'null');
        if (!parsed || typeof parsed.body !== 'string' || !parsed.body.trim() || parsed.body.length > 12000) {
          throw Error('没有识别到完整题干，请调整选区后重试。');
        }
        const candidate = {
          title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.slice(0, 80) : '拍照录入',
          body: parsed.body,
          type: Object.hasOwn(exerciseTypes, parsed.type) ? parsed.type : '',
          options: Array.isArray(parsed.options) ? parsed.options.filter(value => typeof value === 'string').slice(0, 8) : [],
          blankCount: Number.isInteger(parsed.blankCount) && parsed.blankCount >= 1 && parsed.blankCount <= 20 ? parsed.blankCount : null,
          knowledgePoints: []
        };
        openExerciseCapture({kind: 'photo', questionLabel: '拍照录入', messageIndex: uid(), content: ''}, null, {photo, candidate});
      } catch (error) {
        if (active()) showMediaError(status, error instanceof SyntaxError ? Error('题面格式有误，请重试。') : error);
      } finally {
        if (active()) {
          delete recognize.dataset.pending;
          buttons.forEach(button => { button.disabled = false; });
        }
      }
    };
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-study-photo]')) openPhoto();
  });
  window.addEventListener('pagehide', () => {
    if (recording) finishRecording(recording, true);
    stopPlayback();
  });
})();
