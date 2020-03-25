const vec3 = glMatrix.vec3;
const mat4 = glMatrix.mat4;
const glm = glMatrix.glMatrix;

const fragShaderSource = `#version 300 es
precision highp float;

uniform sampler2D texture0;

out vec4 outColor;

void main() {
    //outColor = vec4(1.0,1.0,texture2D(texture, vec2(1.0,1.0)), 1.0);
    vec2 var = vec2(4.0, 4.0);
    //float texOut = 50.0 * texture(texture0, var).w;
    //outColor = vec4(0.0, 0.0, texOut, 1.0);
    
    vec4 texOut = texture(texture0, vec2(0.5,0.4));
    outColor = vec4(0.0,0.5,0.5,1.0);
}
`

const vertexShaderSource = `#version 300 es
layout (location = 0) in vec3 a_position;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

out vec3 pos;
out mat4 viewMat;
out vec4 fragPos;

void main() {
    gl_Position = projection * view * model * vec4(a_position, 1.0);
    pos = a_position;
    viewMat = view;
    fragPos = vec4(model * vec4(a_position, 1.0));
}
`

const sineShaderSource = `#version 300 es
layout (location = 0) in vec3 a_position;

uniform sampler2D texture0;

uniform float time;
uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;
uniform int renderSine;
uniform float sineAmplitude;
uniform float cycloidAmplitude;

uniform int freqWidth;
uniform int freqLength;


int decode(in sampler2D tex, in vec2 pos)
{
    int val = 0;
    vec4 texOut = floor(texture(tex, pos) * 255.0);
    val = (int(texOut.r) << 24) + (int(texOut.g) << 16) + (int(texOut.b) << 8) + (int(texOut.a));

    return val;
}

vec3 sine(in vec3 pos, in float time) {
    float omega = 1.0;
    
    float yval = 0.0;
    int texFreq;
    vec2 texPos;
    for (float i = 0.0; i <= float(freqWidth); i++)
    {
        texPos = vec2(1.0 / (float(freqWidth)-i), 0.0);
        //texFreq = texture(texture0, vec2(texPos,0.0)).w * 255.0;
        texFreq = decode(texture0, texPos);
        yval += sineAmplitude * sin((pos.x - omega * time) * float(texFreq));
    }

    return vec3(pos.x, yval, pos.z);
}

vec3 cycloid(in vec3 pos, in float time)
{
    float omega = 1.0;
    
    float yval = 0.0;
    float xval = 0.0;
    float zval = 0.0;
    int texFreq;
    vec2 texPos;
    for (float i = 0.0; i <= float(freqWidth); i++)
    {
        texPos = vec2(1.0 / (float(freqWidth)-i), 0.0);
        texFreq = decode(texture0, texPos);
        xval += cycloidAmplitude * cos((pos.z - time * omega) * float(texFreq));
        yval += cycloidAmplitude * sin((pos.z - time * omega) * float(texFreq));
    }
    
    return vec3(xval,yval,pos.z);
}

void main() {
    float omega = 1.0;
    vec3 newPos;

    if (renderSine == 1)
    {
        newPos = sine(a_position, time);
    }
    else
    {
        newPos = cycloid(a_position, time);
    }
    
    gl_Position = projection * view * model * vec4(newPos, 1.0);
}
`

let globalTime;

function sine(x) 
{
    return Math.sin(x);
}

function generateFunc(size, dx, vertices, indices)
{
    for (let i = -size; i <= size; i += dx)
    {
        vertices.push(i);
        vertices.push(0);
        vertices.push(0);
    }

    for (let i = 0; i < size * 2 / dx; i++)
    {
        indices.push(i);
        indices.push(i+1);
    }
}

function generateCycloid(size, dx, vertices, indices)
{
    for (let i = -size; i <= size; i += dx)
    {
        vertices.push(0);
        vertices.push(0);
        vertices.push(i);
    }

    for (let i = 0; i < size * 2 / dx; i++)
    {
        indices.push(i);
        indices.push(i+1);
    }
}

function test() 
{
    const canvas = document.getElementById("c");
    const gl = canvas.getContext("webgl2");
    if (!gl) {
        console.log("ERROR");
        return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, sineShaderSource);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragShaderSource);
    const shaderProg = createProgram(gl, vertexShader, fragShader);

    
    let camera = {
        pos: vec3.fromValues(1.0, 1.0, 1.0),
        front: vec3.fromValues(0.0, 0.0, -1.0),
        up: vec3.fromValues(0.0, 1.0, 0.0),
        dir: vec3.fromValues(0.0, 0.0, 0.0),
        fov: {
            deg: 100,
            upDegrees: 45,
            downDegrees: 45,
            leftDegrees: 45,
            rightDegrees: 45,
        },
        scale: 1,
        view: mat4.create(),
    }

    let scene = {
        model: mat4.create(),
        projection: mat4.create(),
    }

    let state = {
        aspectRatio: canvas.width / canvas.height,
        scaledWidth: 10 * 2,
        scaledHeight: 0,
        speed: 0,
        cycloidScaledWidth: 44,
        sineScaledWidth: 20,
        sineAmplitude: 1,
        cycloidAmplitude: 1,
    }

    state.scaledHeight = state.scaledWidth / state.aspectRatio;

    console.log(state);

    /*
    let aspectRatio = canvas.width / canvas.height;
    let scaledWidth = 10 * 2; // 10 units on both sides of origin
    let scaledHeight = scaledWidth / aspectRatio;
    */

    mat4.ortho(scene.projection, -state.scaledWidth/2, state.scaledWidth/2, -state.scaledHeight/2, state.scaledHeight/2, -20.0, 20.0);
    //mat4.perspective(scene.projection, glm.toRadian(45), canvas.width / canvas.height, 0.1, 100.0);
    mat4.lookAt(camera.view, camera.pos, camera.dir, camera.up);

    let vertices = [];
    let indices = [];
    generateFunc(10, .001, vertices, indices);

    const funcVAO = gl.createVertexArray();
    gl.bindVertexArray(funcVAO);

    const funcVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, funcVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    const funcIBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, funcIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    let cycloidVerts = [];
    let cycloidIndices = [];
    generateCycloid(10, 0.001, cycloidVerts, cycloidIndices);
    
    const cycloidVAO = gl.createVertexArray();
    gl.bindVertexArray(cycloidVAO);

    const cycloidVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cycloidVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cycloidVerts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    const cycloidIBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cycloidIBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cycloidIndices), gl.STATIC_DRAW);

    
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    let test = new Uint8Array([
        255, 0, 0, 1, 0, 255, 0, 20, 0, 0, 255, 3,
        0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3,
        0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3,
    ]);

    let genFreq = function(freqs) {
       let outFreqs = new Uint8Array(freqs.length*4); 
       
       j = 0;
       for (let i = 0; i < freqs.length * 4; i+=4)
       {
           outFreqs[i+3] = freqs[j] & 0xFF;           // Mask the lowest 8 bits
           outFreqs[i+2] = (freqs[j] >> 8) & 0xFF;   // Shift 8 then mask the lowest 8 bits
           outFreqs[i+1] = (freqs[j] >> 16) & 0xFF;  // Shift 16 then mask the lowest 8 bits
           outFreqs[i] = (freqs[j] >> 24) & 0xFF;    // Shift 24 then mask the lowest 8 bits
           j += 1;
       }
       return outFreqs;
    };
    let frequencies = new Uint8Array();
    frequencies = genFreq([1,2,3,4,5,6,100]);
    console.log(frequencies);

    let texData = new Uint8Array([0, 0, 255, 255, 255, 0 ,0, 255]);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frequencies.length/4, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, frequencies);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    

    let mouseScroll = function(e) {
        state.aspectRatio = canvas.width / canvas.height;
        state.scaledWidth += e.deltaY / 100;
        state.scaledHeight = state.scaledWidth / state.aspectRatio;
        console.log("scaledWidth: " + state.scaledWidth + " : deltaY: " + e.deltaY);
    }

    canvas.addEventListener("wheel", mouseScroll, false);
    
    webglUtils.resizeCanvasToDisplaySize(gl.canvas, window.devicePixelRatio);

    var stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    // ==
    // GL
    // ==

    let animate = function(time)
    {
        stats.begin();
        globalTime = time / 1000;
            

        gl.enable(gl.DEPTH_TEST);
        //gl.enable(gl.FRAMEBUFFER_SRGB);
        //gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
        gl.clearColor(0,0,0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(shaderProg);
        
        gl.uniform1f(gl.getUniformLocation(shaderProg, "time"), globalTime);
        gl.uniform1i(gl.getUniformLocation(shaderProg, "freqWidth"), frequencies.length / 4);
        gl.uniform1i(gl.getUniformLocation(shaderProg, "freqHeight"), 1);
        gl.uniform1f(gl.getUniformLocation(shaderProg, "sineAmplitude"), state.sineAmplitude);
        gl.uniform1f(gl.getUniformLocation(shaderProg, "cycloidAmplitude"), state.cycloidAmplitude);
        

        gl.viewport(0, gl.canvas.height / 2, gl.canvas.width / 2, gl.canvas.height / 2);
        gl.bindVertexArray(cycloidVAO);
        
        camera.pos = vec3.fromValues(1.0,1.0,1.0);
        mat4.lookAt(camera.view, camera.pos, camera.dir, camera.up);
        mat4.ortho(scene.projection, -state.scaledWidth/1.25, state.scaledWidth/1.25, -state.scaledHeight/1.25, state.scaledHeight/1.25, -20.0, 20.0);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "projection"), false, scene.projection);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "view"), false, camera.view);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "model"), false, scene.model);
        gl.uniform1i(gl.getUniformLocation(shaderProg, "renderSine"), 0);
        gl.drawElements(gl.LINES, cycloidIndices.length, gl.UNSIGNED_SHORT, 0);
        
        camera.pos = vec3.fromValues(0.0, 0.0, 1.0);
        mat4.lookAt(camera.view, camera.pos, camera.dir, camera.up);
        mat4.ortho(scene.projection, -state.scaledWidth/1.25, state.scaledWidth/1.25, -state.scaledHeight/1.25, state.scaledHeight/1.25, -20.0, 20.0);
        gl.viewport(gl.canvas.width / 2, gl.canvas.height / 2, gl.canvas.width / 2, gl.canvas.height / 2);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "projection"), false, scene.projection);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "view"), false, camera.view);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "model"), false, scene.model);
        gl.drawElements(gl.LINES, cycloidIndices.length, gl.UNSIGNED_SHORT, 0);


        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height / 2);
        gl.bindVertexArray(funcVAO);
        
        camera.pos = vec3.fromValues(0.0, 0.0, 1.0);
        mat4.lookAt(camera.view, camera.pos, camera.dir, camera.up);
        mat4.ortho(scene.projection, -state.scaledWidth/2, state.scaledWidth/2, -state.scaledHeight, state.scaledHeight, -20.0, 20.0);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "projection"), false, scene.projection);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "view"), false, camera.view);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProg, "model"), false, scene.model);
        gl.uniform1i(gl.getUniformLocation(shaderProg, "renderSine"), 1);

        gl.drawElements(gl.LINES, indices.length, gl.UNSIGNED_SHORT, 0);
        
        stats.end();
        window.requestAnimationFrame(animate);
    };

    animate(0);
    
    let speed = 10;
    let testFunc = function() {
        this.text = "Hello";
        this.speed = 10;
        this.vals = [1,2,3,4];
    };
    
    let gui = new dat.GUI();
    gui.add(state, "scaledWidth", 0, 10);
    gui.add(state, "sineAmplitude", 0, 10);
    gui.add(state, "cycloidAmplitude", 0, 10);
}

window.onload(test());