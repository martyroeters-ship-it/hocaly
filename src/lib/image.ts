const MAX_EDGE = 1600
const QUALITY = 0.82

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read that image. Try JPEG or PNG."))
    }
    image.src = url
  })
}

export async function compressPhoto(file: File): Promise<{ mimeType: string; data: string; previewUrl: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a photo of the page.")
  }
  const image = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not prepare the photo.")
  context.drawImage(image, 0, 0, width, height)
  const mimeType = "image/jpeg"
  const dataUrl = canvas.toDataURL(mimeType, QUALITY)
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1)
  return { mimeType, data, previewUrl: dataUrl }
}
