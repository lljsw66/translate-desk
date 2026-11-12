<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import WindowControls from '../components/WindowControls.vue';
import { getConfig, saveConfig } from '../lib/desktop';
import type { AppConfig } from '@shared/config';

const baiduAppId = ref('');
const baiduKey = ref('');
const tencentId = ref('');
const tencentKey = ref('');
const tencentRegion = ref('ap-guangzhou');
const llmBaseUrl = ref('');
const llmApiKey = ref('');
const llmModel = ref('');
const youdaoEnabled = ref(true);
const bingEnabled = ref(true);

const reveal = ref(false);
const saving = ref(false);
const savedTip = ref('');

const keyType = computed(() => (reveal.value ? 'text' : 'password'));

const baiduReady = computed(() => Boolean(baiduAppId.value.trim() && baiduKey.value.trim()));
const tencentReady = computed(() => Boolean(tencentId.value.trim() && tencentKey.value.trim()));
const llmReady = computed(() =>
  Boolean(llmBaseUrl.value.trim() && llmApiKey.value.trim() && llmModel.value.trim()),
);

const sources = computed(() => [
  {
    name: '百度官方 API',
    note: baiduReady.value ? '标准版每月 5 万字符免费' : '未填写 AppID / 密钥',
    state: baiduReady.value ? '已启用' : '未启用',
    ok: baiduReady.value,
  },
  {
    name: '腾讯官方 API',
    note: tencentReady.value ? '按量计费，每月 500 万字符免费' : '未填写 SecretId / SecretKey',
    state: tencentReady.value ? '已启用' : '未启用',
    ok: tencentReady.value,
  },
  {
    name: '有道翻译',
    note: '免 Key，以中英日为主',
    state: youdaoEnabled.value ? '可用' : '已关闭',
    ok: youdaoEnabled.value,
  },
  {
    name: '微软必应',
    note: '免 Key，全语种',
    state: bingEnabled.value ? '可用' : '已关闭',
    ok: bingEnabled.value,
  },
  {
    name: '大模型 API',
    note: llmReady.value ? `${llmModel.value.trim()}` : '未填写 Base URL / Key / 模型',
    state: llmReady.value ? '已启用' : '未启用',
    ok: llmReady.value,
  },
]);

const shortcuts = [
  { name: '唤起主窗', keys: 'Ctrl + Shift + Space' },
  { name: '划词翻译', keys: 'Ctrl + Shift + D' },
];

onMounted(async () => {
  const cfg = await getConfig();
  baiduAppId.value = cfg.baidu?.appId ?? '';
  baiduKey.value = cfg.baidu?.key ?? '';
  tencentId.value = cfg.tencent?.secretId ?? '';
  tencentKey.value = cfg.tencent?.secretKey ?? '';
  tencentRegion.value = cfg.tencent?.region || 'ap-guangzhou';
  llmBaseUrl.value = cfg.llm?.baseUrl ?? '';
  llmApiKey.value = cfg.llm?.apiKey ?? '';
  llmModel.value = cfg.llm?.model ?? '';
  youdaoEnabled.value = cfg.youdaoEnabled !== false;
  bingEnabled.value = cfg.bingEnabled !== false;
});

async function save() {
  if (saving.value) return;

  const payload: AppConfig = {
    youdaoEnabled: youdaoEnabled.value,
    bingEnabled: bingEnabled.value,
  };

  const appId = baiduAppId.value.trim();
  const bdKey = baiduKey.value.trim();
  if (appId || bdKey) payload.baidu = { appId, key: bdKey };

  const secretId = tencentId.value.trim();
  const secretKey = tencentKey.value.trim();
  if (secretId || secretKey) {
    payload.tencent = {
      secretId,
      secretKey,
      region: tencentRegion.value.trim() || 'ap-guangzhou',
    };
  }

  const baseUrl = llmBaseUrl.value.trim();
  const apiKey = llmApiKey.value.trim();
  const model = llmModel.value.trim();
  if (baseUrl || apiKey || model) payload.llm = { baseUrl, apiKey, model };

  saving.value = true;
  await saveConfig(payload);
  saving.value = false;
  savedTip.value = '已保存，立即生效';
  window.setTimeout(() => (savedTip.value = ''), 1800);
}
</script>

<template>
  <div class="window">
    <header class="titlebar">
      <span class="brand-mark">译</span>
      <span class="titlebar-name">设置</span>
      <span class="spacer" />
      <WindowControls :show-settings="false" :show-minimize="false" close-hint="关闭设置" />
    </header>

    <div class="settings-body">
      <section class="section">
        <h3 class="section-title">翻译源</h3>
        <p class="hint">按顺序自动降级，未配置的源会被跳过。</p>
        <ol class="source-list">
          <li v-for="(source, index) in sources" :key="source.name" class="source-item">
            <span class="index">{{ index + 1 }}</span>
            <span class="source-text">
              <span class="source-name">{{ source.name }}</span>
              <span class="source-note">{{ source.note }}</span>
            </span>
            <span class="pill" :class="{ ok: source.ok }">{{ source.state }}</span>
          </li>
        </ol>
      </section>

      <section class="section">
        <div class="section-head">
          <h3 class="section-title">账号配置</h3>
          <label class="reveal">
            <input v-model="reveal" type="checkbox" />
            显示密钥
          </label>
        </div>

        <div class="card">
          <div class="card-title">
            百度翻译开放平台
            <span class="pill" :class="{ ok: baiduReady }">
              {{ baiduReady ? '已启用' : '未启用' }}
            </span>
          </div>
          <label class="field">
            <span>AppID</span>
            <input v-model="baiduAppId" placeholder="百度翻译开放平台 appid" spellcheck="false" />
          </label>
          <label class="field">
            <span>密钥</span>
            <input
              v-model="baiduKey"
              :type="keyType"
              placeholder="开放平台控制台获取的密钥"
              spellcheck="false"
            />
          </label>
          <p class="card-hint">申请地址 fanyi-api.baidu.com，通用文本翻译标准版有免费额度。</p>
        </div>

        <div class="card">
          <div class="card-title">
            腾讯云机器翻译
            <span class="pill" :class="{ ok: tencentReady }">
              {{ tencentReady ? '已启用' : '未启用' }}
            </span>
          </div>
          <label class="field">
            <span>SecretId</span>
            <input v-model="tencentId" placeholder="CAM 访问密钥 SecretId" spellcheck="false" />
          </label>
          <label class="field">
            <span>SecretKey</span>
            <input
              v-model="tencentKey"
              :type="keyType"
              placeholder="CAM 访问密钥 SecretKey"
              spellcheck="false"
            />
          </label>
          <label class="field">
            <span>地域</span>
            <input v-model="tencentRegion" placeholder="ap-guangzhou" spellcheck="false" />
          </label>
          <p class="card-hint">账号需具备 TMT 机器翻译（TextTranslate）调用权限。</p>
        </div>

        <div class="card">
          <div class="card-title">
            大模型（OpenAI 兼容）
            <span class="pill" :class="{ ok: llmReady }">
              {{ llmReady ? '已启用' : '未启用' }}
            </span>
          </div>
          <label class="field">
            <span>Base URL</span>
            <input
              v-model="llmBaseUrl"
              placeholder="https://api.deepseek.com/v1"
              spellcheck="false"
            />
          </label>
          <label class="field">
            <span>API Key</span>
            <input
              v-model="llmApiKey"
              :type="keyType"
              placeholder="sk-..."
              spellcheck="false"
            />
          </label>
          <label class="field">
            <span>模型</span>
            <input v-model="llmModel" placeholder="deepseek-chat" spellcheck="false" />
          </label>
          <p class="card-hint">接口需兼容 /chat/completions，作为最后一级兜底。</p>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">免 Key 翻译源</h3>
        <div class="row">
          <span class="row-text">
            <span class="row-name">有道翻译</span>
            <span class="row-note">以中英日互译为主，关闭后不再参与降级</span>
          </span>
          <button
            class="switch"
            :class="{ on: youdaoEnabled }"
            role="switch"
            :aria-checked="youdaoEnabled"
            @click="youdaoEnabled = !youdaoEnabled"
          >
            <span class="knob" />
          </button>
        </div>
        <div class="row">
          <span class="row-text">
            <span class="row-name">微软必应</span>
            <span class="row-note">全语种覆盖，作为免 Key 兜底</span>
          </span>
          <button
            class="switch"
            :class="{ on: bingEnabled }"
            role="switch"
            :aria-checked="bingEnabled"
            @click="bingEnabled = !bingEnabled"
          >
            <span class="knob" />
          </button>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">快捷键</h3>
        <div v-for="item in shortcuts" :key="item.name" class="row">
          <span class="row-name">{{ item.name }}</span>
          <kbd class="keys">{{ item.keys }}</kbd>
        </div>
      </section>

      <p class="footnote">配置写入用户目录下的 config.json，保存后下一次翻译立即生效。</p>
    </div>

    <footer class="settings-foot">
      <span class="save-tip">{{ savedTip }}</span>
      <button class="save-btn" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存配置' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.settings-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px;
  background: var(--bg);
}

.section {
  margin-bottom: 18px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.reveal {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  color: var(--text-subtle);
  font-size: 11px;
  cursor: pointer;
}

.reveal input {
  width: 12px;
  height: 12px;
  accent-color: var(--brand);
}

.hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--text-subtle);
}

.source-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: var(--surface);
}

.source-item + .source-item {
  border-top: 1px solid var(--border);
}

.index {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 10px;
  font-weight: 600;
}

.source-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.source-name {
  font-size: 12px;
  color: var(--text);
}

.source-note {
  font-size: 10px;
  color: var(--text-subtle);
}

.pill {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 10px;
}

.pill.ok {
  background: var(--brand-soft);
  color: var(--brand);
}

.card {
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.field > span {
  flex: 0 0 68px;
  color: var(--text-muted);
  font-size: 11px;
}

.field input {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  outline: none;
}

.field input:focus {
  border-color: var(--brand-border);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.field input::placeholder {
  color: var(--text-subtle);
}

.card-hint {
  margin: 4px 0 0;
  color: var(--text-subtle);
  font-size: 10px;
  line-height: 1.6;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 0;
  font-size: 12px;
  color: var(--text);
}

.row + .row {
  border-top: 1px dashed var(--border);
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-name {
  color: var(--text-muted);
}

.row-note {
  color: var(--text-subtle);
  font-size: 10px;
}

.keys {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 10px;
}

.footnote {
  margin: 0;
  padding-top: 4px;
  color: var(--text-subtle);
  font-size: 10px;
  line-height: 1.6;
}

.settings-foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  height: 42px;
  padding: 0 14px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.save-tip {
  color: var(--brand);
  font-size: 11px;
}

.save-btn {
  height: 26px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: var(--brand);
  color: #fff;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.save-btn:hover {
  background: var(--brand-hover);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
