import sharp from 'sharp'
import { resolve } from 'node:path'

const source = resolve('public/icons/icon.svg')
for (const size of [180, 192, 512]) await sharp(source).resize(size, size).png().toFile(resolve(`public/icons/icon-${size}.png`))
console.log('Generated Repwise PNG icons: 180, 192, 512')
