import {tgpu} from 'typegpu';

// Geometry is rasterized with the selected algorithm; WebGPU presents the pixel-exact result.
export async function createGpuPresenter(canvas: HTMLCanvasElement) {
    if (!navigator.gpu) return undefined;
    const root = await tgpu.init();
    const context = root.configureContext({canvas, alphaMode: 'opaque'});
    const device = root.device;
    const shader = device.createShaderModule({
        code: `
    struct Output { @builtin(position) position: vec4f, @location(0) uv: vec2f }
    @vertex fn vertex(@builtin(vertex_index) i: u32) -> Output {
      var positions = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
      var out: Output;
      out.position = vec4f(positions[i], 0, 1);
      out.uv = vec2f((positions[i].x+1)*0.5, (1-positions[i].y)*0.5);
      return out;
    }
    @group(0) @binding(0) var image: texture_2d<f32>;
    @group(0) @binding(1) var imageSampler: sampler;
    @fragment fn fragment(in: Output) -> @location(0) vec4f {
      return textureSample(image, imageSampler, in.uv);
    }`
    });
    const pipeline = device.createRenderPipeline({
        layout: 'auto', vertex: {module: shader, entryPoint: 'vertex'},
        fragment: {
            module: shader,
            entryPoint: 'fragment',
            targets: [{format: navigator.gpu.getPreferredCanvasFormat()}]
        },
        primitive: {topology: 'triangle-list'},
    });
    const sampler = device.createSampler({magFilter: 'nearest', minFilter: 'nearest'});
    let texture: GPUTexture | undefined;
    let group: GPUBindGroup | undefined;
    return {
        present(source: HTMLCanvasElement) {
            if (!texture || texture.width !== source.width || texture.height !== source.height) {
                texture?.destroy();
                texture = device.createTexture({
                    size: [source.width, source.height],
                    format: 'rgba8unorm',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
                });
                group = device.createBindGroup({
                    layout: pipeline.getBindGroupLayout(0),
                    entries: [{binding: 0, resource: texture.createView()}, {binding: 1, resource: sampler}]
                });
            }
            if (!group) return;
            device.queue.copyExternalImageToTexture({source}, {texture}, [source.width, source.height]);
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: {r: 1, g: 1, b: 1, a: 1}
                }]
            });
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, group);
            pass.draw(3);
            pass.end();
            device.queue.submit([encoder.finish()]);
        },
        destroy() {
            texture?.destroy();
            root.destroy();
        },
        lost: device.lost,
    };
}
