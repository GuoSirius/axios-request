<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';

const logs = ref<Array<{ time: string; message: string }>>([]);
const isLoading = ref(false);
const requestCount = ref(0);
const cancelledCount = ref(0);

const config = reactive({
  enabled: true,
  methods: ['GET'],
  simulateCancel: true,
});

const addLog = (message: string) => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message });
  if (logs.value.length > 50) logs.value.pop();
};

const testRequest = () => {
  requestCount.value++;
  addLog(`发起请求 #${requestCount.value}`);
  
  if (!config.enabled) {
    addLog(`管理器已禁用，直接发起请求 #${requestCount.value}`);
    addLog(`请求 #${requestCount.value} 完成`);
    ElMessage.success(`请求 #${requestCount.value} 完成`);
    return;
  }
  
  isLoading.value = true;
  addLog(`请求 #${requestCount.value} 执行中...`);
  
  // 模拟请求
  setTimeout(() => {
    if (config.simulateCancel && requestCount.value > 1) {
      cancelledCount.value++;
      addLog(`请求 #${requestCount.value} 被取消`);
      isLoading.value = false;
      ElMessage.warning(`请求 #${requestCount.value} 被取消`);
    } else {
      addLog(`请求 #${requestCount.value} 完成`);
      isLoading.value = false;
      ElMessage.success(`请求 #${requestCount.value} 完成`);
    }
  }, 800);
};

const clearLogs = () => {
  logs.value = [];
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      取消请求管理器测试
    </h2>
    
    <p class="text-light/70 mb-8">
      测试取消请求管理器的自动取消、自定义方法等功能
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 配置面板 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">🚫</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">配置面板</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">启用状态</label>
          <el-switch v-model="config.enabled" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">模拟取消</label>
          <el-switch v-model="config.simulateCancel" />
        </div>
      </div>

      <!-- 请求统计 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">📊</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">请求统计</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">总请求数</label>
          <div class="text-3xl font-bold text-primary">{{ requestCount }}</div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">被取消数</label>
          <div class="text-3xl font-bold text-danger">{{ cancelledCount }}</div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">取消率</label>
          <div class="text-3xl font-bold text-success">
            {{ requestCount > 0 ? Math.round((cancelledCount / requestCount) * 100) : 0 }}%
          </div>
        </div>
      </div>
    </div>

    <!-- 测试操作区 -->
    <div class="mt-8 card-glow">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
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
          @click="requestCount = 0; cancelledCount = 0" 
          size="large"
        >
          重置统计
        </el-button>
      </div>
    </div>

    <!-- 请求日志 -->
    <div class="mt-8 card-glow">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
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