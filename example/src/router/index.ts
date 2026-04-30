import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../layouts/MainLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'Home',
          component: () => import('../views/HomeView.vue'),
        },
        {
          path: 'token',
          name: 'Token',
          component: () => import('../views/TokenView.vue'),
        },
        {
          path: 'retry',
          name: 'Retry',
          component: () => import('../views/RetryView.vue'),
        },
        {
          path: 'dedupe',
          name: 'Dedupe',
          component: () => import('../views/DedupeView.vue'),
        },
        {
          path: 'cancel',
          name: 'Cancel',
          component: () => import('../views/CancelView.vue'),
        },
        {
          path: 'combined',
          name: 'Combined',
          component: () => import('../views/CombinedView.vue'),
        },
        {
          path: 'utils',
          name: 'Utils',
          component: () => import('../views/UtilsView.vue'),
        },
      ],
    },
  ],
});

export default router;
