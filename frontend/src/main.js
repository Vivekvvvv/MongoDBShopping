import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

import './assets/legacy-style.css';
import './assets/ep-theme.css';
import './assets/app-theme.css';

createApp(App).use(router).use(ElementPlus).mount('#app');
