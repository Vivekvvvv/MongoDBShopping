<template>
  <section>
    <!-- Hero Section -->
    <el-card class="home-hero" shadow="never" :body-style="{ padding: '56px 40px' }">
      <div style="text-align: center; color: white;">
        <h1 style="margin: 0 0 12px 0; font-size: 2.4em;">智能推荐商城</h1>
        <p style="margin: 0 0 28px 0; opacity: 0.92; font-size: 1.1em;">基于购买量和库存的智能推荐，为您精选优质商品</p>

        <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <RouterLink to="/recommended" style="text-decoration: none;">
            <el-button type="primary" size="large" round>
              <i class="fas fa-star" style="margin-right: 8px;"></i>
              推荐商品
            </el-button>
          </RouterLink>
          <RouterLink to="/products" style="text-decoration: none;">
            <el-button size="large" round plain>
              <i class="fas fa-th" style="margin-right: 8px;"></i>
              全部商品
            </el-button>
          </RouterLink>
        </div>
      </div>
    </el-card>

    <!-- Features Section (Static Content for Landing Page) -->
    <el-row :gutter="18" style="margin-bottom: 18px;">
      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="home-feature">
          <div style="text-align: center;">
            <i class="fas fa-rocket" style="font-size: 2.2em; color: var(--el-color-primary); margin-bottom: 12px;"></i>
            <h3 style="margin: 0 0 8px 0;">快速发货</h3>
            <p style="margin: 0; opacity: 0.78;">多仓直发，极速配送，让您无需等待。</p>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="home-feature">
          <div style="text-align: center;">
            <i class="fas fa-shield-alt" style="font-size: 2.2em; color: var(--el-color-success); margin-bottom: 12px;"></i>
            <h3 style="margin: 0 0 8px 0;">品质保障</h3>
            <p style="margin: 0; opacity: 0.78;">严格质检，正品保证，购物无忧。</p>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="home-feature">
          <div style="text-align: center;">
            <i class="fas fa-headset" style="font-size: 2.2em; color: var(--el-color-warning); margin-bottom: 12px;"></i>
            <h3 style="margin: 0 0 8px 0;">专属客服</h3>
            <p style="margin: 0; opacity: 0.78;">7x24小时在线客服，随时为您解答疑问。</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </section>
</template>

<script setup>
// Home uses Element Plus for unified UI.
</script>

<style scoped>
.home-hero {
  margin-bottom: 18px;
  border: none;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 55%, var(--el-color-primary-light-5) 100%);
}

.home-feature :deep(.el-card__body) {
  padding: 22px;
}
</style>
