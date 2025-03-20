import { SplineScene } from "./spline";
 
export function SplineSceneBasic() {
  return (
    <div className="w-full h-[800px] bg-black/[0.96] relative overflow-hidden">
      <div className="h-full">
        <SplineScene 
          scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
          className="w-full h-full"
        />
      </div>
    </div>
  )
} 