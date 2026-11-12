<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import WindowControls from '../components/WindowControls.vue';
import { setPopupTarget, setSelectionAuto, translateText } from '../lib/desktop';
import type { LangCode } from '@shared/translate';

const languages: { value: LangCode; label: string }[] = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'es', label: '西班牙语' },
  { value: 'ru', label: '俄语' },
];

const selectionOn = ref(true);
const sourceLang = ref<LangCode>('auto');
const targetLang = ref<LangCode>('zh');
const inputText = ref('');
const outputText = ref('');
const provider = ref('');
const errorText = ref('');
const loading = ref(false);
const elapsed = ref(0);
const copied = ref(false);

const charCount = computed(() => inputText.value.length);
const outputCount = computed(() => outputText.value.length);

let seq = 0;
let timer: number | undefined;

async function run() {
  const text = inputText.value.trim();
  errorText.value = '';

  if (!text) {
    outputText.value = '';
    provider.value = '';
    elapsed.value = 0;
    return;
  }

  const id = ++seq;
  const started = Date.now();
  loading.value = true;

  const res = await translateText({
    text,
    from: sourceLang.value,
    to: targetLang.value,
  });

  if (id !== seq) return; // 丢弃过期结果

  loading.value = false;
  elapsed.value = Date.now() - started;

  if (res.ok) {
    outputText.value = res.text;
    provider.value = res.provider + (res.cached ? ' · 缓存' : '');
    return;
  }

  outputText.value = '';
  provider.value = '';
  const detail = res.attempts.map((item) => `${item.provider}: ${item.message}`).join('；');
  errorText.value = detail ? `${res.message}（${detail}）` : res.message;
}

watch(inputText, () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(run, 600);
});

watch([sourceLang, targetLang], () => {
  window.clearTimeout(timer);
  void setPopupTarget(targetLang.value);
  void run();
});

watch(selectionOn, (enabled) => void setSelectionAuto(enabled));

onMounted(() => {
  void setSelectionAuto(selectionOn.value);
  void setPopupTarget(targetLang.value);
});

onBeforeUnmount(() => window.clearTimeout(timer));

function swapLangs() {
  if (sourceLang.value === 'auto') return;
  const previous = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = previous;
}

function clearInput() {
  inputText.value = '';
  outputText.value = '';
  provider.value = '';
  errorText.value = '';
  elapsed.value = 0;
}

async function copyResult() {
  if (!outputText.value) return;
  await navigator.clipboard.writeText(outputText.value);
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1200);
}
</script>

<template>
  <div class="window">
    <header class="titlebar">
      <span class="brand-mark">译</span>
      <span class="titlebar-name">桌面翻译</span>
      <span class="spacer" />
      <WindowControls show-pin close-hint="隐藏到托盘" />
    </header>

    <div class="langbar">
      <select v-model="sourceLang" class="lang-select">
        <option v-for="lang in languages" :key="lang.value" :value="lang.value">
          {{ lang.label }}
        </option>
      </select>

      <button class="swap-btn" title="交换语言" @click="swapLangs">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 8h13M14 4l4 4-4 4" />
          <path d="M20 16H7M10 12l-4 4 4 4" />
        </svg>
      </button>

      <select v-model="targetLang" class="lang-select">
        <option
          v-for="lang in languages.filter((item) => item.value !== 'auto')"
          :key="lang.value"
          :value="lang.value"
        >
          {{ lang.label }}
        </option>
      </select>

      <span class="spacer" />

      <div class="selection-toggle">
        <span>划词</span>
        <button
          class="switch"
          :class="{ on: selectionOn }"
          role="switch"
          :aria-checked="selectionOn"
          @click="selectionOn = !selectionOn"
        >
          <span class="knob" />
        </button>
      </div>
    </div>

    <main class="panes">
      <section class="pane">
        <textarea
          v-model="inputText"
          class="editor"
          placeholder="输入或粘贴原文…"
          spellcheck="false"
        />
        <div class="pane-foot">
          <span>{{ charCount }} 字符</span>
          <button class="link-btn" :disabled="!inputText" @click="clearInput">清空</button>
        </div>
      </section>

      <section class="pane">
        <div class="result">
          <p v-if="errorText" class="result-error">{{ errorText }}</p>
          <p v-else-if="outputText" class="result-text">{{ outputText }}</p>
          <p v-else class="result-placeholder">
            {{ loading ? '翻译中…' : '译文将显示在这里' }}
          </p>
        </div>
        <div class="pane-foot">
          <span>引擎：{{ provider || (loading ? '翻译中' : '—') }}</span>
          <span class="pane-foot-right">
            {{ outputCount }} 字符
            <button class="link-btn" :disabled="!outputText" @click="copyResult">
              {{ copied ? '已复制' : '复制' }}
            </button>
          </span>
        </div>
      </section>
    </main>

    <footer class="statusbar">
      <span v-if="errorText">翻译失败</span>
      <span v-else-if="loading">正在翻译…</span>
      <span v-else-if="inputText">已完成 · {{ elapsed }} ms</span>
      <span v-else>输入文本自动翻译</span>
      <span class="status-right">
        <i class="status-dot" :class="{ busy: loading, error: !!errorText }" />
        {{ sourceLang === 'auto' ? '自动检测' : '指定语种' }} → {{ targetLang }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.langbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.lang-select {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.lang-select:focus {
  border-color: var(--brand-border);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.swap-btn {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.swap-btn:hover {
  background: var(--surface-muted);
  color: var(--brand);
}

.langbar .spacer {
  flex: 1;
}

.selection-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.panes {
  flex: 1;
  min-height: 0;
  display: flex;
}

.pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.pane + .pane {
  border-left: 1px solid var(--border);
}

.editor {
  flex: 1;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  line-height: 1.65;
  user-select: text;
}

.editor::placeholder {
  color: var(--text-subtle);
}

.result {
  flex: 1;
  padding: 10px 12px;
  overflow-y: auto;
  user-select: text;
}

.result-placeholder {
  margin: 0;
  color: var(--text-subtle);
  font-size: 13px;
  line-height: 1.65;
}

.result-text {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.result-error {
  margin: 0;
  color: var(--danger, #e8463a);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}

.pane-foot {
  flex: 0 0 auto;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-top: 1px solid var(--border);
  color: var(--text-subtle);
  font-size: 11px;
}

.pane-foot-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pane-foot .link-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.statusbar {
  flex: 0 0 auto;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-subtle);
  font-size: 11px;
}

.status-right {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--brand);
}

.status-dot.busy {
  background: var(--warning, #efaa17);
}

.status-dot.error {
  background: var(--danger, #e8463a);
}
</style>
