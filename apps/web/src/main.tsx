import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LazyMotion } from "motion/react";
import App from "./App";
import "./index.css";

const loadMotionFeatures = () => import("./components/ui/motion-features").then((mod) => mod.default);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <App />
    </LazyMotion>
  </StrictMode>,
);
