import { toCanvas } from "html-to-image";

export function assertImageFits(node: HTMLElement) {
  const elements = Array.from(node.querySelectorAll<HTMLElement>("[data-fit]"));
  const overflow = elements.find((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 8);
  if (overflow) throw new Error("配图文案超出画布，请缩短文案并保留限定语后重试。");
}

export async function renderImagePng(node: HTMLElement): Promise<Blob> {
  await Promise.all([document.fonts.load('400 24px "Geist"'), document.fonts.load('700 60px "Geist"')]);
  await document.fonts.ready;
  if (!document.fonts.check('400 24px "Geist"') || !document.fonts.check('700 60px "Geist"')) throw new Error("本地字体尚未加载，请稍后重试。");
  await Promise.all(Array.from(node.querySelectorAll("img"), (img) => img.decode()));
  assertImageFits(node);
  const rendered = await toCanvas(node, { width: 1200, height: 675, pixelRatio: window.devicePixelRatio || 1, backgroundColor: "#0f172a", style: { transform: "none", margin: "0" } });
  // Render with the device ratio, then normalize the actual downloadable attachment dimensions.
  const output = document.createElement("canvas");
  output.width = 1200;
  output.height = 675;
  const context = output.getContext("2d");
  if (!context) throw new Error("浏览器无法创建配图画布。");
  context.drawImage(rendered, 0, 0, 1200, 675);
  return new Promise((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG 导出失败，请重试。")), "image/png"));
}

export async function downloadImagePng(node: HTMLElement, name: string) {
  const blob = await renderImagePng(node);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Allow the browser to consume the download before releasing its object URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
