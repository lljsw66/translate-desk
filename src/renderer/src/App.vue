<script setup lang="ts">
import MainWindow from './windows/MainWindow.vue';
import PopupWindow from './windows/PopupWindow.vue';
import SettingsWindow from './windows/SettingsWindow.vue';

function resolveWindow(): 'main' | 'popup' | 'settings' {
  const target = new URLSearchParams(location.search).get('win');
  if (target === 'popup' || target === 'settings') {
    return target;
  }
  return 'main';
}

const which = resolveWindow();
</script>

<template>
  <MainWindow v-if="which === 'main'" />
  <PopupWindow v-else-if="which === 'popup'" />
  <SettingsWindow v-else />
</template>
