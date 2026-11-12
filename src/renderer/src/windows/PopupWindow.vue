<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { onSelectionText, resizePopup, translateText } from '../lib/desktop';
import type { LangCode } from '@shared/translate';

const source = ref('');
const result = ref('');
const errorText = ref('');
const loading = ref(false);
const tipRef = ref<HTMLElement | null>(null);

let seq = 0;

/** 内容变化后按实际尺寸收缩 Tooltip 窗口 */
async function syncSize() {
  await nextTick();
  const el = tipRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  await resizePopup(Math.ceil(rect.width) + 1, Math.ceil(rect.height) + 1);
}

onSelectionText(async (payload) => {
  const text = payload.text.trim();
  if (!text) return;

  const id = ++seq;
  source.value = text;
  result.value = '';
  errorText.value = '';
  loading.value = true;

  const res = await translateText({
    text,
    from: 'auto',
    to: (payload.to || 'zh') as LangCode,
  });

  if (id !== seq) return;

  loading.value = false;
  if (res.ok) result.value = res.text;
  else errorText.value = '翻译失败';
});

watch([source, result, errorText, loading], () => void syncSize());
</script>

<template>
  <div ref="tipRef" class="tip">
    <span class="tip-source">{{ source }}</span>
    <span class="tip-divider">|</span>
    <span class="tip-result" :class="{ pending: loading, failed: !!errorText }">
      {{ errorText || result || '…' }}
    </span>
  </div>
</template>

<style scoped>
.tip {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  width: max-content;
  max-width: 420px;
  padding: 6px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  line-height: 18px;
}

.tip-source {
  flex: 0 1 auto;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
}

.tip-divider {
  flex: 0 0 auto;
  color: var(--border-strong);
}

.tip-result {
  flex: 0 1 auto;
  max-width: 300px;
  color: var(--text);
  word-break: break-word;
  white-space: normal;
}

.tip-result.pending {
  color: var(--text-subtle);
}

.tip-result.failed {
  color: var(--danger);
}
</style>
