<script lang="ts" setup>
import {getTodayDateString} from '~/utils/datetime';

await navigateTo(`/${getTodayDateString()}`, {replace: true})
</script>

<template>
  <div class="loading">Redirecting to today's news...</div>
</template>

<style scoped>
.loading {
  padding: 2rem;
  text-align: center;
  font-size: 1.2rem;
}
</style>
