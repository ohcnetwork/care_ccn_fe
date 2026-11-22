import "@/index.css";

export { default as manifest } from "@/manifest";
export { default as routes } from "@/routes";

declare global {
  interface Window {
    CARE_API_URL: string;
  }
}
