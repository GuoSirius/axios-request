<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';

const logs = ref<Array<{ time: string; message: string }>>([]);
const isLoading = ref(false);
const requestCount = ref(0);
const blockedCount = ref(0);

const config = reactive({
  enabled: true,
  timeWindow: 1000,
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  simulateDedupe: true,
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
  
  if (config.simulateDedupe && requestCount.value > 1) {
    blockedCount.value++;
    addLog(`请求 #${requestCount.value} 被去重`);
    ElMessage.warning(`请求 #${requestCount.value} 被去重`);
    return;
  }
  
  // 模拟请求
  isLoading.value = true;
  addLog(`请求 #${requestCount.value} 执行中...`);
  
  setTimeout(() => {
    addLog(`请求 #${requestCount.value} 完成`);
    isLoading.value = false;
    ElMessage.success(`请求 #${requestCount.value} 完成`);
  }, 1000);
};

const clearLogs = () => {
  logs.value = [];
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      防重复提交管理器测试
    </h2>
    
    <p class="text-light/70 mb-8">
      测试防重复提交管理器的去重、时间窗口、自定义 key 等功能
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 配置面板 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">📑</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">配置面板</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">启用状态</label>
          <el-switch v-model="config.enabled" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">时间窗口（ms）：{{ config.timeWindow }}</label>
          <el-slider v-model="config.timeWindow" :min="500" :max="5000" :step="100" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">模拟去重</label>
          <el-switch v-model="config.simulateDedupe" />
        </div>
      </div>

      <!-- 请求统计 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">📊</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">请求统计</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">总请求数</label>
          <div class="text-3xl font-bold text-primary">{{ requestCount }}</div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">被去重数</label>
          <div class="text-3xl font-bold text-warning">{{ blockedCount }}</div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">去重率</label>
          <div class="text-3xl font-bold text-success">
            {{ requestCount > 0 ? Math.round((blockedCount / requestCount) * 100) : 0 }}%
          </div>
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
          {{ isLoading ? '请求中...' : '发起请求' }}
        </el-button>
        
        <el-button 
          type="warning" 
          @click="requestCount = 0; blockedCount = 0" 
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
          暂无日志，点击"发起请求"开始测试
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>