<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

// 模拟 token 状态
const tokenStatus = ref<'valid' | 'expired' | 'refreshing'>('valid');
const accessToken = ref('abc123');
const refreshToken = ref('def456');
const logs = ref<Array<{ time: string; message: string }>>([]);

// 配置
const config = reactive({
  enabled: true,
  whitelistUrls: '/api/public',
  simulateExpired: false,
});

const addLog = (message: string) => {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ time, message });
  if (logs.value.length > 50) logs.value.pop();
};

const simulateTokenExpired = () => {
  tokenStatus.value = 'expired';
  addLog('模拟 token 过期');
  ElMessage.warning('Token 已过期，将自动刷新');
};

const simulateRefreshToken = () => {
  tokenStatus.value = 'refreshing';
  addLog('开始刷新 token...');
  
  // 模拟刷新请求
  setTimeout(() => {
    accessToken.value = 'new-access-token-' + Date.now().toString(36);
    refreshToken.value = 'new-refresh-token-' + Date.now().toString(36);
    tokenStatus.value = 'valid';
    addLog('Token 刷新成功');
    addLog(`新的 access_token: ${accessToken.value}`);
    ElMessage.success('Token 刷新成功');
  }, 1500);
};

const testRequest = () => {
  addLog('发起请求...');
  
  if (tokenStatus.value === 'expired' && config.enabled) {
    addLog('检测到 token 过期，自动刷新...');
    simulateRefreshToken();
  } else {
    addLog('请求成功：获取到数据');
  }
};

const clearLogs = () => {
  logs.value = [];
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      Token 管理器测试
    </h2>
    
    <p class="text-light/70 mb-8">
      测试 Token 管理器的自动刷新、白名单 URL、自定义认证头等功能
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!--- 配置面板 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">🔑</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">配置面板</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">启用状态</label>
          <el-switch v-model="config.enabled" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">白名单 URL（逗号分隔）</label>
          <el-input v-model="config.whitelistUrls" placeholder="例如：/api/public, /api/health" />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">模拟 token 过期</label>
          <el-switch v-model="config.simulateExpired" />
        </div>
      </div>

      <!--- 状态显示 -->
      <div class="card-glow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mb-4">
          <span class="text-white text-xl">📊</span>
        </div>
        <h3 class="text-xl font-semibold mb-4">状态显示</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Token 状态</label>
          <el-tag :type="tokenStatus === 'valid' ? 'success' : tokenStatus === 'expired' ? 'danger' : 'warning'">
            {{ tokenStatus === 'valid' ? '有效' : tokenStatus === 'expired' ? '已过期' : '刷新中' }}
          </el-tag>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Access Token</label>
          <el-input :value="accessToken" readonly />
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">Refresh Token</label>
          <el-input :value="refreshToken" readonly />
        </div>
      </div>
    </div>

    <!--- 测试操作区 -->
    <div class="mt-8 card-glow">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
        <span class="text-white text-xl">🧪</span>
      </div>
      <h3 class="text-xl font-semibold mb-4">测试操作</h3>
      
      <div class="flex gap-4 flex-wrap">
        <el-button type="primary" @click="testRequest" size="large">
          发起测试请求
        </el-button>
        
        <el-button 
          type="warning" 
          @click="simulateTokenExpired" 
          size="large"
          :disabled="tokenStatus === 'refreshing'"
        >
          模拟 Token 过期
        </el-button>
        
        <el-button 
          type="success" 
          @click="simulateRefreshToken" 
          size="large"
          :disabled="tokenStatus === 'refreshing' || tokenStatus === 'valid'"
        >
          手动刷新 Token
        </el-button>
      </div>
    </div>

    <!--- 请求日志 -->
    <div class="mt-8 card-glow">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
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