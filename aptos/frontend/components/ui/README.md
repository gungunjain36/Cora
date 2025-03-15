# SplineScene Component

This component allows you to integrate interactive 3D scenes from Spline into your React application.

## Installation

To use the SplineScene component, you need to install the following dependencies:

```bash
npm install @splinetool/react-spline
```

Note: The project already has `clsx` and `tailwind-merge` installed, which are used by the Spotlight component.

## Components

### SplineScene

A component that loads and displays a 3D scene from Spline.

```tsx
import { SplineScene } from "@/frontend/components/ui/spline";

<SplineScene 
  scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
  className="w-full h-full"
/>
```

### Spotlight

A component that creates a spotlight effect that follows the mouse cursor.

```tsx
import { Spotlight } from "@/frontend/components/ui/spotlight";

<Spotlight
  className="-top-40 left-0 md:left-60 md:-top-20"
  fill="white"
/>
```

### SplineSceneBasic

A demo component that showcases the SplineScene with a nice layout.

```tsx
import { SplineSceneBasic } from "@/frontend/components/ui/spline-demo";

<SplineSceneBasic />
```

## Usage in the Hero Component

The SplineSceneBasic component has been integrated into the Hero component to showcase the 3D capabilities of the application.

## CSS Requirements

The SplineScene component uses a loader animation that requires the following CSS:

```css
.loader {
  width: 48px;
  height: 48px;
  border: 5px solid #FFF;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

This CSS has been added to the `index.css` file. 