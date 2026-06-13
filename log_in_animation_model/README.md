# Vue 3 Animated Login Module

This module contains a reusable, GSAP-powered interactive character animation component tailored for a login interface. 

The characters dynamically react to user interactions such as typing, focusing on fields, and revealing passwords.

## File Structure

- `AnimatedCharacters.vue` — The core GSAP animation component.
- `LoginTemplate.vue` — A fully functional login page template utilizing the animation component alongside Ant Design Vue.

## Requirements & Dependencies

To use these components in your Vue 3 project, ensure you have the following dependencies installed:

```bash
npm install vue gsap ant-design-vue @ant-design/icons-vue
```
*(Note: `ant-design-vue` is only required if you use `LoginTemplate.vue`.)*

## Usage Instructions

1. **Copy the module**: Move the `AnimatedCharacters.vue` file into your project's `components` directory.
2. **Import and integrate**: Include it in your login page.

### Example Integration

```vue
<template>
  <div style="height: 500px; position: relative;">
    <AnimatedCharacters 
      :isTyping="isTyping" 
      :showPassword="showPassword" 
      :passwordLength="password.length" 
    />
  </div>
  
  <!-- Example Inputs -->
  <input 
    type="text" 
    placeholder="Username" 
    @focus="isTyping = true" 
    @blur="isTyping = false" 
  />
  <input 
    :type="showPassword ? 'text' : 'password'" 
    v-model="password" 
    placeholder="Password" 
  />
  <button @click="showPassword = !showPassword">Toggle Password</button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AnimatedCharacters from './AnimatedCharacters.vue';

const isTyping = ref(false);
const showPassword = ref(false);
const password = ref('');
</script>
```

## Component Props (`AnimatedCharacters.vue`)

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `isTyping` | `boolean` | `false` | When true, triggers characters to tilt inwards and look towards the center of the screen as if they are watching the user type. |
| `showPassword` | `boolean` | `false` | When true, makes the characters reset their stance and look away (avoiding eye contact) to simulate privacy when the password is shown in plain text. |
| `passwordLength` | `number` | `0` | Used in combination with `showPassword`. If length > 0 and `showPassword` is false, characters will occasionally "peek". |

## Core Animation Features
- **Mouse Tracking**: Characters' eyes and faces continuously track the user's cursor position.
- **Typing Focus**: Characters lean toward each other to "watch" the user typing.
- **Password Privacy**: When the password is unmasked (`showPassword = true`), the characters avert their gaze.
- **Random Blinking**: Characters blink randomly at natural intervals.