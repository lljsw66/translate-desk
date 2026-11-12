<script setup lang="ts">
import { ref } from 'vue';
import { hideWindow, minimizeWindow, openSettings, toggleAlwaysOnTop } from '../lib/desktop';

withDefaults(
  defineProps<{
    showPin?: boolean;
    showSettings?: boolean;
    showMinimize?: boolean;
    closeHint?: string;
  }>(),
  {
    showPin: false,
    showSettings: true,
    showMinimize: true,
    closeHint: '关闭',
  },
);

const pinned = ref(true);

async function togglePin() {
  pinned.value = await toggleAlwaysOnTop();
}
</script>

<template>
  <div class="controls">
    <button
      v-if="showPin"
      class="tb-btn"
      :class="{ active: pinned }"
      title="窗口置顶"
      @click="togglePin"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17v5" />
        <path d="M9 3h6l-1.2 6L17 12v2H7v-2l3.2-3L9 3z" />
      </svg>
    </button>

    <button v-if="showSettings" class="tb-btn" title="设置" @click="openSettings">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M4 7h6M14 7h6M4 17h6M14 17h6" />
        <circle cx="12" cy="7" r="2" />
        <circle cx="12" cy="17" r="2" />
      </svg>
    </button>

    <button v-if="showMinimize" class="tb-btn" title="最小化" @click="minimizeWindow">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M5 12h14" />
      </svg>
    </button>

    <button class="tb-btn close" :title="closeHint" @click="hideWindow">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>
