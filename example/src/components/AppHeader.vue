<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const menuItems = [
  { path: '/', name: '首页', icon: 'fa-home' },
  { path: '/token', name: 'Token 管理', icon: 'fa-key' },
  { path: '/retry', name: '失败重试', icon: 'fa-upload' },
  { path: '/dedupe', name: '防重复提交', icon: 'fa-file' },
  { path: '/cancel', name: '取消请求', icon: 'fa-times' },
  { path: '/utils', name: '工具函数', icon: 'fa-wrench' },
  { path: '/combined', name: '多管理器协同', icon: 'fa-link' },
];

const isActive = (path: string) => {
  return router.currentRoute.value.path === path;
};
</script>

<template>
  <header class="card-glow bg-dark-light/80 backdrop-blur-md border-b border-dark-lighter sticky top-0 z-50">
    <div class="container mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <span class="text-white font-bold text-xl">A</span>
        </div>
        <h1 class="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Axios Request
        </h1>
      </div>

      <nav class="flex items-center gap-2">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2"
          :class="isActive(item.path) ? 'bg-primary/20 text-primary' : 'text-light/70 hover:bg-dark-lighter hover:text-light'"
        >
          <i :class="`fa ${item.icon}`"></i>
          <span class="hidden md:inline">{{ item.name }}</span>
        </router-link>
      </nav>
    </div>
  </header>
</template>

<style scoped>
</style>
