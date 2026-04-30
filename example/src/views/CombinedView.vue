<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';

const logs = ref<Array<{ time: string; message: string }>>([]);
const isLoading = ref(false);

const config = reactive({
  token: {
    enabled: true,
    simulateExpired: false,
  },
  retry: {
    enabled: true,
    maxRetries: 3,
    simulateError: true,
  },
  dedupe: {
    enabled: true,
    simulateDedupe: true,
  },
  cancel: {
    enabled: true,
    simulateCancel: true,
  },
});

const addLog = (message: string) => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message });
  if (logs.value.length > 50) logs.value.pop();
};

const testRequest = () => {
  addLog('发起多管理器协同测试请求...');
  isLoading.value = true;
  
  // 模拟多管理器协同
  setTimeout(() => {
    if (config.dedupe.enabled && config.dedupe.simulateDedupe) {
      addLog('防重复提交管理器：检测到重复请求，已去重');
    }
    
    if (config.cancel.enabled && config.cancel.simulateCancel) {
      addLog('取消请求管理器：取消上一次相同请求');
    }
    
    if (config.retry.enabled && config.retry.simulateError) {
      addLog('请求失败，重试管理器：准备重试...');
      
      setTimeout(() => {
        addLog('重试管理器：第1次重试...');
        
        setTimeout(() => {
          if (config.token.enabled && config.token.simulateExpired) {
            addLog('Token 管理器：检测到 token 过期，刷新中...');
            
            setTimeout(() => {
              addLog('Token 管理器：刷新成功');
              addLog('请求成功：获取到数据');
              isLoading.value = false;
              ElMessage.success('所有管理器协同测试完成');
            }, 1000);
          } else {
            addLog('请求成功：获取到数据');
            isLoading.value = false;
            ElMessage.success('所有管理器协同测试完成');
          }
        }, 800);
      }, 500);
    } else {
      addLog('请求成功：获取到数据');
      isLoading.value = false;
      ElMessage.success('所有管理器协同测试完成');
    }
  }, 500);
};

const clearLogs = () => {
  logs.value = [];
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      多管理器协同测试
    </h2>
    
    <p class="text-light/70 mb-8">
      测试多个管理器同时工作的协同效果
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Token 管理器配置 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">🔑</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">Token 管理器</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">启用状态</label>
          <el-switch v-model="config.token.enabled" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">模拟 token 过期</label>
          <el-switch v-model="config.token.simulateExpired" />
        </div>
      </div>

      <!-- 重试管理器配置 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">🔄</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">重试管理器</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">启用状态</label>
          <el-switch v-model="config.retry.enabled" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">最大重试次数：{{ config.retry.maxRetries }}</label>
          <el-slider v-model="config.retry.maxRetries" :min="1" :max="10" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">模拟请求失败</label>
          <el-switch v-model="config.retry.simulateError" />
        </div>
      </div>

      <!-- 防重复提交配置 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">📑</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">防重复提交</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">启用状态</label>
          <el-switch v-model="config.dedupe.enabled" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">模拟去重</label>
          <el-switch v-model="config.dedupe.simulateDedupe" />
        </div>
      </div>

      <!-- 取消请求配置 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">🚫</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">取消请求</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">启用状态</label>
          <el-switch v-model="config.cancel.enabled" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">模拟取消</label>
          <el-switch v-model="config.cancel.simulateCancel" />
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
          {{ isLoading ? '请求中...' : '发起协同测试请求' }}
        </el-button>
      </div>
    </div>

    <!-- 请求日志 -->
    <div class="mt-8 card-glow">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
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
          <span :class="{
            'text-green-400': log.message.includes('成功'),
            'text-yellow-400': log.message.includes('重试') || log.message.includes('刷新'),
            'text-red-400': log.message.includes('失败') || log.message.includes('取消'),
            'text-light/80': !log.message.includes('成功') && !log.message.includes('重试') && !log.message.includes('刷新') && !log.message.includes('失败') && !log.message.includes('取消'),
          }">{{ log.message }}</span>
        </div>
        
        <div v-if="logs.length === 0" class="text-center text-light/40 py-8">
          暂无日志，点击"发起协同测试请求"开始测试
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>