import { hex2rgb, deg2rad, loadExternalFile } from './js/utils/utils.js'
import Input from './js/input/input.js'
import * as mat4 from './js/lib/glmatrix/mat4.js'
import * as vec3 from './js/lib/glmatrix/vec3.js'
import * as quat4 from './js/lib/glmatrix/quat.js'
import { Box } from './js/app/object3d.js'
import { Scene, SceneNode } from './assignment1.scene.js'

class WebGlApp {
    constructor(gl, shader, app_state) {
        // Set up WebGL options
        this.setGlFlags(gl)

        // Save the shader
        this.shader = shader
        
        // Create a 3D box
        this.box = new Box(gl, shader)

        // Store the scene (if loaded)
        this.scene = null

        // Set up file loading from the UI
        app_state.onOpen3DScene((filename) => {
            let scene_config = JSON.parse(loadExternalFile(`./scenes/${filename}`))
            this.scene = new Scene(scene_config, gl, shader)
            return this.scene
        })

        // Set up the camera position and view
        this.eye = [2.0, 0.5, -2.0]
        this.center = [0, 0, 0]

        this.forward = null
        this.right = null
        this.up = null

        this.updateViewSpaceVectors()
        this.view = mat4.lookAt(mat4.create(), this.eye, this.center, [0, 1, 0])

        // Set up projection matrix
        let fovy = deg2rad(60)
        let aspect = 16 / 9
        let near = 0.1
        let far = 100.0
        this.projection = mat4.perspective(mat4.create(), fovy, aspect, near, far)

        // Send view and projection matrices to the shader
        this.shader.use()
        this.shader.setUniform4x4f('u_v', this.view)
        this.shader.setUniform4x4f('u_p', this.projection)
        this.shader.unuse()
    }

    setGlFlags(gl) {
        // Enable depth testing
        gl.enable(gl.DEPTH_TEST)
    }

    setViewport(gl, width, height) {
        // Set the viewport size
        gl.viewport(0, 0, width, height)
    }

    clearCanvas(gl) {
        // Clear the canvas with a black background
        gl.clearColor(...hex2rgb('#000000'), 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    }

    update(gl, app_state, delta_time) {
        // Get the current drawing mode from the UI
        let drawMode = app_state.getState('Draw Mode');

        // Choose the WebGL drawing mode
        let glDrawMode;
        if (drawMode === 'Points') {
            glDrawMode = gl.POINTS;
        } else if (drawMode === 'Triangles') {
            glDrawMode = gl.TRIANGLES;
        }

        // Apply the drawing mode to all scene nodes
        if (this.scene != null) {
            for (let node of this.scene.getNodes()) {
                if (node instanceof SceneNode && node.type === "model") {
                    node.setDrawMode(glDrawMode);
                }
            }
        }

        // Handle camera or scene node controls
        switch (app_state.getState('Control')) {
            case 'Camera':
                this.updateCamera(delta_time);
                break;
            case 'Scene Node':
                if (this.scene == null) break;

                let scene_node = this.scene.getNode(app_state.getState('Select Scene Node'));
                this.updateSceneNode(scene_node, delta_time);
                break;
        }
    }

    updateViewSpaceVectors() {
        // Update the camera's direction vectors
        this.forward = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), this.eye, this.center))
        this.right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), [0, 1, 0], this.forward))
        this.up = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), this.forward, this.right))
    }

    updateCamera(delta_time) {
        let view_dirty = false;

        // Zoom in or out with the right mouse button
        if (Input.isMouseDown(2)) {
            let zoom = Input.getMouseDy() * delta_time * 0.5;
            vec3.scaleAndAdd(this.eye, this.eye, this.forward, zoom);
            view_dirty = true;
        }

        // Rotate the camera with the left mouse button
        if (Input.isMouseDown(0) && !Input.isKeyDown(' ')) {
            let deltaX = -Input.getMouseDx() * delta_time * 0.5;
            let deltaY = -Input.getMouseDy() * delta_time * 0.5;

            let rotationY = mat4.create();
            mat4.rotate(rotationY, mat4.create(), deltaX, [0, 1, 0]);
            vec3.transformMat4(this.eye, this.eye, rotationY);

            let rotationX = mat4.create();
            mat4.rotate(rotationX, mat4.create(), deltaY, this.right);
            vec3.transformMat4(this.eye, this.eye, rotationX);

            view_dirty = true;
        }

        // Pan the view with the middle mouse button or space + left mouse
        if (Input.isMouseDown(1) || (Input.isMouseDown(0) && Input.isKeyDown(' '))) {
            let panX = -Input.getMouseDx() * delta_time * 0.5;
            let panY = Input.getMouseDy() * delta_time * 0.5;

            let rightTranslation = vec3.scale(vec3.create(), this.right, panX);
            let upTranslation = vec3.scale(vec3.create(), this.up, panY);
            vec3.add(this.eye, this.eye, rightTranslation);
            vec3.add(this.center, this.center, rightTranslation);
            vec3.add(this.eye, this.eye, upTranslation);
            vec3.add(this.center, this.center, upTranslation);

            view_dirty = true;
        }

        // Update the view matrix if anything changed
        if (view_dirty) {
            this.updateViewSpaceVectors();
            this.view = mat4.lookAt(mat4.create(), this.eye, this.center, [0, 1, 0]);

            this.shader.use();
            this.shader.setUniform4x4f('u_v', this.view);
            this.shader.unuse();
        }
    }

    updateSceneNode(node, delta_time) {
        let node_dirty = false;

        let translation = mat4.create();
        let rotation = mat4.create();
        let scale = mat4.create();

        // Scale the node with the right mouse button
        if (Input.isMouseDown(2)) {
            let scaleAmount = 1 + Input.getMouseDy() * delta_time * 0.1;
            mat4.scale(scale, scale, [scaleAmount, scaleAmount, scaleAmount]);
            node_dirty = true;
        }

        // Rotate the node with the left mouse button
        if (Input.isMouseDown(0) && !Input.isKeyDown(' ')) {
            let deltaX = Input.getMouseDy() * delta_time * 0.5;
            let deltaY = -Input.getMouseDx() * delta_time * 0.5;

            mat4.rotate(rotation, rotation, deltaY, [0, 1, 0]);
            mat4.rotate(rotation, rotation, deltaX, this.right);

            node_dirty = true;
        }

        // Move the node with the middle mouse button or space + left mouse
        if (Input.isMouseDown(1) || (Input.isMouseDown(0) && Input.isKeyDown(' '))) {
            let panX = Input.getMouseDx() * delta_time * 0.5;
            let panY = -Input.getMouseDy() * delta_time * 0.5;

            let rightTranslation = vec3.scale(vec3.create(), this.right, panX);
            let upTranslation = vec3.scale(vec3.create(), this.up, panY);
            mat4.translate(translation, translation, rightTranslation);
            mat4.translate(translation, translation, upTranslation);

            node_dirty = true;
        }

        // Apply transformations if anything changed
        if (node_dirty) {
            let transformation = node.getTransformation();

            mat4.multiply(transformation, rotation, transformation);
            mat4.multiply(transformation, scale, transformation);
            mat4.multiply(transformation, translation, transformation);

            node.setTransformation(transformation);
        }
    }

    render(gl, canvas_width, canvas_height) {
        this.setViewport(gl, canvas_width, canvas_height);
        this.clearCanvas(gl);

        this.box.render(gl);

        if (this.scene) this.scene.render(gl);
    }
}

export {
    WebGlApp
}
