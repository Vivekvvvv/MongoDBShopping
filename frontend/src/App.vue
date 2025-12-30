<template>
  <div>
    <NavBar v-if="!isAuthPage" />
    <CartSidebar v-if="!isAuthPage" />

    <main v-if="!isAuthPage" class="container">
      <RouterView />
    </main>
    <RouterView v-else />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from './components/NavBar.vue';
import CartSidebar from './components/CartSidebar.vue';

const route = useRoute();

const isAuthPage = computed(() => route.name === 'login');
</script>
