<template>
  <div class="container">
    <!-- Left Panel -->
    <div class="leftPanel">
      <div class="leftTop">
        <span class="brandName">Your Brand</span>
      </div>

      <div class="charactersArea">
        <AnimatedCharacters
          :isTyping="isTyping"
          :showPassword="showPassword"
          :passwordLength="passwordValue.length"
        />
      </div>

      <div class="leftFooter">
        <a href="#">Help Center</a>
        <a href="#">Privacy Policy</a>
      </div>

      <div class="decorBlur1" />
      <div class="decorBlur2" />
      <div class="decorGrid" />
    </div>

    <!-- Right Panel -->
    <div class="rightPanel">
      <div class="formWrapper">
        <div class="mobileLogo">
          <span>Your Brand Platform</span>
        </div>

        <div class="formHeader">
          <h1 class="formTitle">Sign in to Workspace</h1>
          <p class="formSubtitle">
            Unified access to all frontend systems
          </p>
        </div>

        <a-form
          :model="formState"
          name="login"
          @finish="handleLogin"
          autocomplete="off"
          size="large"
          class="form"
        >
          <div class="fieldLabel">Username</div>
          <a-form-item
            name="username"
            :rules="[
              { required: true, message: 'Please enter your username' },
              { min: 3, message: 'Username must be at least 3 characters long' },
            ]"
          >
            <a-input
              v-model:value="formState.username"
              placeholder="Enter your username"
              @focus="isTyping = true"
              @blur="isTyping = false"
            >
              <template #prefix>
                <UserOutlined class="prefixIcon" />
              </template>
            </a-input>
          </a-form-item>

          <div class="fieldLabel">Password</div>
          <a-form-item
            name="password"
            :rules="[
              { required: true, message: 'Please enter your password' },
              { min: 6, message: 'Password must be at least 6 characters long' },
            ]"
          >
            <a-input
              v-model:value="formState.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter your password"
            >
              <template #prefix>
                <LockOutlined class="prefixIcon" />
              </template>
              <template #suffix>
                <span class="eyeToggle" @click="showPassword = !showPassword">
                  <EyeOutlined v-if="showPassword" />
                  <EyeInvisibleOutlined v-else />
                </span>
              </template>
            </a-input>
          </a-form-item>

          <div v-if="error" class="errorBox">{{ error }}</div>

          <a-form-item style="margin-bottom: 0">
            <a-button
              type="primary"
              html-type="submit"
              :loading="loading"
              block
              class="submitBtn"
            >
              {{ loading ? 'Signing in...' : 'Sign in' }}
            </a-button>
          </a-form-item>
        </a-form>

        <div class="divider">
          <span>OR</span>
        </div>

        <a-button block class="googleBtn">
          <template #icon><GoogleOutlined /></template>
          Sign in with Google
        </a-button>

        <div class="signupRow">
          Don't have an account?
          <a href="#" class="signupLink">
            Contact administrator to request access
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { message } from 'ant-design-vue';
import {
  UserOutlined,
  LockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  GoogleOutlined
} from '@ant-design/icons-vue';
// Updated import to point to the local AnimatedCharacters component
import AnimatedCharacters from './AnimatedCharacters.vue';

const loading = ref(false);
const showPassword = ref(false);
const isTyping = ref(false);
const error = ref('');

const formState = reactive({
  username: '',
  password: ''
});

const passwordValue = computed(() => formState.password);

async function mockLogin(values: any) {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { data: { access_token: 'mock_token_' + Date.now() } };
}

const handleLogin = async (values: any) => {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await mockLogin(values);
    localStorage.setItem('access_token', data.access_token);
    message.success('Login Successful');
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  } catch {
    error.value = 'Invalid username or password, please try again';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 1024px) {
  .container {
    grid-template-columns: 1fr;
  }
}

/* Left Panel */
.leftPanel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px;
  background: linear-gradient(145deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%);
  overflow: hidden;
}

@media (max-width: 1024px) {
  .leftPanel {
    display: none;
  }
}

.leftTop {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.brandName {
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
}

.charactersArea {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 500px;
}

.leftFooter {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 24px;
}

.leftFooter a {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  transition: color 0.2s;
  cursor: pointer;
}

.leftFooter a:hover {
  color: rgba(255, 255, 255, 0.85);
}

.decorBlur1 {
  position: absolute;
  top: 15%;
  right: 10%;
  width: 300px;
  height: 300px;
  background: rgba(59, 130, 246, 0.25);
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}

.decorBlur2 {
  position: absolute;
  bottom: 10%;
  left: 5%;
  width: 400px;
  height: 400px;
  background: rgba(30, 64, 175, 0.3);
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  z-index: 0;
}

.decorGrid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 1;
}

/* Right Panel */
.rightPanel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #ffffff;
}

.formWrapper {
  width: 100%;
  max-width: 400px;
}

.mobileLogo {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 48px;
}

@media (max-width: 1024px) {
  .mobileLogo {
    display: flex;
  }
}

.formHeader {
  text-align: center;
  margin-bottom: 40px;
}

.formTitle {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
  margin: 0 0 10px 0;
  line-height: 1.3;
}

.formSubtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
}

.form :deep(.ant-form-item) {
  margin-bottom: 20px;
}

.form :deep(.ant-input-affix-wrapper) {
  height: 48px !important;
  background: #fafafa !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 10px !important;
  transition: border-color 0.2s, box-shadow 0.2s !important;
}

.form :deep(.ant-input-affix-wrapper:hover) {
  border-color: #3b82f6 !important;
}

.form :deep(.ant-input-affix-wrapper:focus),
.form :deep(.ant-input-affix-wrapper-focused) {
  border-color: #1e40af !important;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.08) !important;
  background: #ffffff !important;
}

.form :deep(.ant-input-affix-wrapper .ant-input) {
  background: transparent !important;
  font-size: 14px !important;
  color: #111827 !important;
}

.form :deep(.ant-input-affix-wrapper .ant-input::placeholder) {
  color: #c0c4cc !important;
}

.form :deep(.ant-form-item-explain-error) {
  font-size: 13px !important;
  margin-top: 4px !important;
}

.fieldLabel {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
  letter-spacing: 0.2px;
}

.prefixIcon {
  color: #b0b7c3;
  font-size: 15px;
}

.eyeToggle {
  color: #6b7280;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.eyeToggle:hover {
  color: #374151;
}

.errorBox {
  padding: 10px 14px;
  font-size: 13px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  margin-bottom: 16px;
}

.submitBtn {
  height: 48px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  border-radius: 10px !important;
  background: #1e40af !important;
  border-color: #1e40af !important;
  letter-spacing: 1px;
  transition: background 0.2s, opacity 0.2s !important;
  cursor: pointer;
}

.submitBtn:hover {
  background: #1d4ed8 !important;
  border-color: #1d4ed8 !important;
  opacity: 1 !important;
}

.submitBtn:active {
  opacity: 0.85 !important;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 0;
  color: #d1d5db;
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.divider span {
  color: #9ca3af;
  white-space: nowrap;
}

.googleBtn {
  height: 48px !important;
  font-size: 14px !important;
  border-radius: 10px !important;
  margin-top: 12px !important;
  background: #ffffff !important;
  border: 1px solid #e5e7eb !important;
  color: #374151 !important;
  transition: background 0.2s, border-color 0.2s !important;
  cursor: pointer;
}

.googleBtn:hover {
  background: #eff6ff !important;
  border-color: rgba(30, 64, 175, 0.25) !important;
  color: #1e40af !important;
}

.signupRow {
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  margin-top: 28px;
}

.signupLink {
  color: #1e40af;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.signupLink:hover {
  text-decoration: underline;
  color: #1d4ed8;
}
</style>