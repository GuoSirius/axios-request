<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { RefreshCcw, Document, Close, Upload, Tools } from '@element-plus/icons-vue';

const router = useRouter();

const features = [
  {
    title: 'Token 管理',
    description: '自动处理 token 过期，支持刷新 token、白名单 URL、自定义认证头',
    icon: RefreshCcw,
    path: '/token',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    title: '失败重试',
    description: '自动重试失败的请求，支持指数退避、自定义重试条件',
    icon: Upload,
    path: '/retry',
    color: 'from-purple-500 to-pink-500',
  },
  {
    title: '防重复提交',
    description: '防止重复提交表单，支持时间窗口、自定义去重 key',
    icon: Document,
    path: '/dedupe',
    color: 'from-green-500 to-teal-500',
  },
  {
    title: '取消请求',
    description: '自动取消上一次相同请求（适用于搜索等场景）',
    icon: Close,
    path: '/cancel',
    color: 'from-orange-500 to-red-500',
  },
  {
    title: '工具函数',
    description: '请求 key 生成、FormData 转换、配置合并等工具函数',
    icon: Tools,
    path: '/utils',
    color: 'from-indigo-500 to-blue-500',
  },
];
const goTo = (path: string) => {
  router?.push(path);
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="text-center mb-12">
      <h1 class="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        Axios Request Example
      </h1>
      <p class="text-light/70 text-lg">
        基于 axios 的增强请求库，支持 Token 管理、失败重试、防重复提交、请求取消等功能
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        v-for="feature in features"
        :key="feature.path"
        class="card-glow cursor-pointer transition-all duration-300 hover:scale-105"
        @click="goTo(feature.path)"
      >
        <div :class="`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`">
          <component :is="feature.icon" class="w-6 h-6 text-white" />
        </div>
        <h3 class="text-xl font-semibold mb-2">{{ feature.title }}</h3>
        <p class="text-light/70">
          {{ feature.description }}
        </p>
      </div>
    </div>

    <div class="mt-12 text-center">
      <div class="card-glow cursor-pointer transition-all duration-300 hover:scale-105" @click="goTo('/combined')">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-4 inline-flex">
          <span class="text-white text-2xl">🔗</span>
        </div>
        <h3 class="text-xl font-semibold mb-2">多管理器协同</h3>
        <p class="text-light/70">
          测试多个管理器同时工作的协同效果
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
