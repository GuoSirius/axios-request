<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';

const logs = ref<Array<{ time: string; message: string }>>([]);
const isLoading = ref(false);
const retryCount = ref(0);

const config = reactive({
  enabled: true,
  maxRetries: 3,
  retryDelay: 100,
  exponentialBackoff: false,
  simulateError: true,
});

const addLog = (message: string) => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message });
  if (logs.value.length > 50) logs.value.pop();
};

const testRequest = () => {
  retryCount.value = 0;
  addLog('发起请求...');
  isLoading.value = 
  // 模拟请求
  simulateRequest();
};

const simulateRequest = () => {
  if (!config.enabled) {
    addLog('管理器已禁用，直接发起请求');
    addLog('请求成功：获取到数据');
    isLoading.value = false;
    ElMessage.success('请求成功');
    return;
  }

  if (config.simulateError && retryCount.value < config.maxRetries) {
    retryCount.value++;
    addLog(`请求失败，准备第 ${retryCount.value} 次重试...`);
    
    // 计算延迟
    let delay = config.retryDelay;
    if (config.exponentialBackoff) {
      delay = config.retryDelay * Math.pow(2, retryCount.value - 1);
    }
    
    addLog(`等待 ${delay}ms 后重试...`);
    
    setTimeout(() => {
      simulateRequest();
    }, delay);
  } else {
    if (config.simulateError) {
      addLog('已达到最大重试次数，请求失败');
      isLoading.value = false;
      ElMessage.error('请求失败，已达最大重试次数');
    } else {
      addLog('请求成功：获取到数据');
      isLoading.value = false;
      ElMessage.success('请求成功');
    }
  }
};

const clearLogs = () => {
  logs.value = [];
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      请求重试管理器测试
    </h2>
    
    <p class="text-light/70 mb-8">
      测试请求重试管理器的自动重试、指数退避、自定义重试条件等功能
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 配置面板 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">🔄</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">配置面板</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">启用状态</label>
          <el-switch v-model="config.enabled" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">最大重试次数：{{ config.maxRetries }}</label>
          <el-slider v-model="config.maxRetries" :min="1" :max="10" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">重试延迟（ms）：{{ config.retryDelay }}</label>
          <el-input-number v-model="config.retryDelay" :min="100" :max="5000" :step="100" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">指数退避</label>
          <el-switch v-model="config.exponentialBackoff" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">模拟请求失败</label>
          <el-switch v-model="config.simulateError" />
        </div>
      </div>

      <!-- 重试进度 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">📊</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">重试进度</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">当前重试次数</label>
          <div class="flex items-center gap-2">
            <el-progress 
              :percentage="config.enabled ? (retryCount / config.maxRetries) * 100 : 0" 
              :format="() => `${retryCount}/${config.maxRetries}`"
              class="flex-1"
            />
          </div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">状态</label>
          <el-tag :type="isLoading ? 'warning' : 'success'">
            {{ isLoading ? '请求中...' : '空闲' }}
          </el-tag>
        </div>
      </div>
    </div>

    <!-- 测试操作区 -->
    <div class="mt-8 card-glow">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <span class="text-white text-xl">🧪</span>
        </div>
        <h3 class="text-xl font-semibold">测试操作</h3>
      </div>
      
      <div class="flex gap-4 flex-wrap">
        <el-button 
          type="primary" 
          @click="testRequest" 
          size="large"
          :loading="isLoading"
        >
          {{ isLoading ? '请求中...' : '发起测试请求' }}
        </el-button>
        
        <el-button 
          type="warning" 
          @click="config.simulateError = !config.simulateError" 
          size="large"
        >
          {{ config.simulateError ? '模拟失败' : '模拟成功' }}
        </el-button>
      </div>
    </div>

    <!-- 请求日志 -->
    <div class="mt-8 card-glow">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <span class="text-white text-xl">📝</span>
          </div>
          <h3 class="text-xl font-semibold">请求日志</h3>
        </div>
        <el-button text @click="clearLogs">清空日志</el-button>
      </div>
      
      <div class="bg-dark/50 rounded-lg p-4 max-h-96 overflow-y-auto">
        <div 
          v-for="(log, index) in logs" 
          :key="index"
          class="py-2 border-b border-dark-lighter last:border-0 font-mono text-sm"
        >
          <span class="text-primary mr-4">[{{ log.time }}]</span>
          <span class="text-light/80">{{ log.message }}</span>
        </div>
        
        <div v-if="logs.length === 0" class="text-center text-light/40 py-8">
          暂无日志，点击"发起测试请求"开始测试
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>