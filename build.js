
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from './tailwind.config.js';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const distDir = path.resolve(rootDir, 'dist');

const entryPoints = [
    'index.tsx',
    'background.js',
    'content_script.js'
];

const staticAssets = [
    'manifest.json',
    'popup.html',
    'index.html',
    'icons',
    'locales'
];

// --- Build Logic ---

/**
 * Cleans the distribution directory to ensure a fresh build.
 */
async function cleanDist() {
    console.log('🧹 Cleaning output directory...');
    await fs.rm(distDir, { recursive: true, force: true });
    await fs.mkdir(distDir, { recursive: true });
}

/**
 * Copies static assets to the distribution directory.
 */
async function copyStaticAssets() {
    console.log('📂 Copying static files...');
    for (const asset of staticAssets) {
        const sourcePath = path.resolve(rootDir, asset);
        const destPath = path.resolve(distDir, asset);
        try {
            await fs.cp(sourcePath, destPath, { recursive: true });
            console.log(`   -> Copied ${asset}`);
        } catch (error) {
            console.error(`   -> Error copying ${asset}:`, error);
        }
    }
}

/**
 * Compiles the main CSS file with TailwindCSS and PostCSS.
 */
async function buildStyles() {
    console.log('🎨 Compiling Tailwind CSS...');
    const cssInputPath = path.resolve(rootDir, 'styles', 'main.css');
    const cssOutputPath = path.resolve(distDir, 'styles.css');

    try {
        const css = await fs.readFile(cssInputPath, 'utf8');

        const result = await postcss([
            tailwindcss(tailwindConfig),
            autoprefixer,
        ]).process(css, { from: cssInputPath, to: cssOutputPath });

        await fs.writeFile(cssOutputPath, result.css);
        console.log('✅ CSS compiled successfully.');
    } catch (error) {
        console.error('❌ CSS compilation failed:', error);
        process.exit(1);
    }
}


/**
 * Uses esbuild to bundle, transpile, and minify the application source code.
 */
async function bundleCode() {
    console.log('⚙️  Bundling and transpiling with esbuild...');
    try {
        await esbuild.build({
            entryPoints: entryPoints.map(p => path.resolve(rootDir, p)),
            bundle: true,
            minify: true,
            sourcemap: 'inline', // Use 'external' for separate .map files, or false
            outdir: distDir,
            platform: 'browser',
            format: 'esm', // for background.js "type": "module"
            jsx: 'automatic', // Use automatic JSX transform
            loader: { '.tsx': 'tsx' },
            define: { 'process.env.NODE_ENV': '"production"' }
        });
        console.log('✅ esbuild completed successfully.');
    } catch (error) {
        console.error('❌ esbuild build failed:', error);
        process.exit(1);
    }
}

/**
 * Post-processes HTML files to remove development-only scripts like importmaps
 * and update the main script path to the bundled JS file.
 */
async function postProcessHtml() {
    console.log('📄 Post-processing HTML files...');
    const htmlFiles = [
        path.resolve(distDir, 'index.html'),
        path.resolve(distDir, 'popup.html')
    ];

    for (const filePath of htmlFiles) {
        try {
            let content = await fs.readFile(filePath, 'utf-8');
            // Remove the importmap script tag as it's not needed after bundling
            content = content.replace(/<script type="importmap">[\s\S]*?<\/script>/s, '');
            // Update the main script tag to point to the bundled JS file
            content = content.replace(
              /<script type="module" src="\/index.tsx"><\/script>/, 
              '<script type="module" src="./index.js"></script>'
            );
            await fs.writeFile(filePath, content, 'utf-8');
            console.log(`   -> Processed ${path.basename(filePath)}`);
        } catch (error) {
            console.warn(`   -> Could not process ${path.basename(filePath)}: ${error.message}`);
        }
    }
}


/**
 * Main build function to orchestrate all steps.
 */
async function main() {
    console.log('🚀 Starting Orion Vault extension build...');
    await cleanDist();
    await copyStaticAssets();
    await buildStyles();
    await bundleCode();
    await postProcessHtml();
    console.log('\n🎉 Build complete! The extension is ready in the "dist" folder.');
    console.log('   You can now load it as an "unpacked extension" in your browser.');
}

// --- Run the Build ---
main().catch(e => {
    console.error('An unexpected error occurred during the build:', e);
    process.exit(1);
});