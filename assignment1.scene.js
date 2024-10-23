import { Object3D } from "./js/app/object3d.js"
import { json2transform } from "./js/utils/utils.js"
import * as mat4 from "./js/lib/glmatrix/mat4.js"
import * as quat4 from "./js/lib/glmatrix/quat.js"

import { OBJLoader } from "./assignment1.objloader.js"

/**
 * Represents a 3D scene with objects to draw on screen.
 */
class Scene {

    /**
     * Builds the scene using the provided config.
     */
    constructor(scene_config, gl, shader) {
        this.scene_config = scene_config

        // Load the OBJ models
        this.models = this.loadModels(scene_config.models)

        // Load the scenegraph recursively
        this.scenegraph = this.loadScenegraphNode(scene_config.scenegraph, gl, shader)

        // Set the root's transformation
        this.scenegraph.setTransformation(this.scenegraph.transformation)
    }

    /**
     * Loads models from the scene config.
     */
    loadModels(models_config) {
        let models = {}

        for (let model_config of models_config) {
            let loader = new OBJLoader(model_config.obj)
            models[model_config.name] = loader.load()
        }

        return models
    }

    /**
     * Creates a new 3D object based on a model.
     */
    instantiateModel(name, gl, shader) {
        if (!name in this.models)
            throw `Unable to find model "${name}" requested by scenengraph`

        let [vertices, indices] = this.models[name]

        return new Object3D(gl, shader, vertices, indices, gl.TRIANGLES)
    }

    /**
     * Loads a node from the scenegraph.
     */
    loadScenegraphNode(node_config, gl, shader) {
        let node = null

        switch (node_config.type) {
            case 'node':
                node = new SceneNode(
                    node_config.name,
                    node_config.type,
                    json2transform(node_config.transformation)
                )
                break
            case 'model':
                node = new ModelNode(
                    this.instantiateModel(node_config.content, gl, shader),
                    node_config.name,
                    node_config.type,
                    json2transform(node_config.transformation)
                )
                break
        }

        for (let child of node_config.children) {
            let child_node = this.loadScenegraphNode(child, gl, shader)
            node.addChild(child_node)
            child_node.setParent(node)
        }

        return node
    }

    /**
     * Returns a flat list of all nodes in the scenegraph.
     */
    getNodes() {
        return this.scenegraph.getNodes([])
    }

    /**
     * Finds a node by name.
     */
    getNode(name) {
        let node = this.scenegraph.getNode(name)
        if (node == null)
            throw `Node "${name}" not found in scenegraph`
        return node
    }

    /**
     * Renders the scene.
     */
    render(gl) {
        this.scenegraph.render(gl)
    }
}

/**
 * Represents a node in the scenegraph.
 */
class SceneNode {

    /**
     * Creates a new scene node.
     */
    constructor(name, type, transformation) {
        this.name = name
        this.type = type
        this.transformation = transformation
        this.world_transformation = this.calculateWorldTransformation()
        this.parent = null
        this.children = []
    }

    /**
     * Returns the world transformation of this node.
     */
    getWorldTransformation() {
        return this.world_transformation
    }

    /**
     * Updates the world transformation based on parent transformations.
     */
    calculateWorldTransformation() {
        let world = mat4.create()
        let transformations = this.getTransformationHierarchy([]).reverse()
        for (let transform of transformations) {
            mat4.multiply(world, world, transform)
        }
        return world
    }

    /**
     * Collects transformations from this node up to the root.
     */
    getTransformationHierarchy(transformations) {
        transformations.push(this.transformation)
        if (this.parent != null)
            this.parent.getTransformationHierarchy(transformations)
        return transformations
    }

    /**
     * Returns this node's local transformation.
     */
    getTransformation() {
        return this.transformation
    }

    /**
     * Updates the node's transformation and children.
     */
    setTransformation(transformation) {
        this.transformation = transformation
        for (let child of this.children)
            child.setTransformation(child.transformation)
        this.world_transformation = this.calculateWorldTransformation()
    }

    /**
     * Returns the parent of this node.
     */
    getParent() {
        return this.parent
    }

    /**
     * Sets the parent of this node.
     */
    setParent(node) {
        this.parent = node
    }

    /**
     * Adds a child to this node.
     */
    addChild(node) {
        this.children.push(node)
    }

    /**
     * Returns all nodes under this node.
     */
    getNodes(nodes) {
        nodes.push(this)
        for (let child of this.children)
            child.getNodes(nodes)
        return nodes
    }

    /**
     * Finds a specific node by name.
     */
    getNode(name) {
        if (this.name == name)
            return this

        for (let child of this.children) {
            let node = child.getNode(name)
            if (node != null)
                return node
        }

        return null
    }

    /**
     * Renders all children of this node.
     */
    render(gl) {
        for (let child of this.children) {
            child.render(gl)
        }
    }
}

/**
 * A model node that contains a 3D object.
 */
class ModelNode extends SceneNode {

    /**
     * Creates a new model node with a 3D object.
     */
    constructor(obj3d, name, type, transformation) {
        super(name, type, transformation)
        this.obj3d = obj3d
    }

    /**
     * Sets the drawing mode for the 3D object.
     */
    setDrawMode(draw_mode) {
        this.obj3d.setDrawMode(draw_mode)
    }

    /**
     * Updates the transformation of the 3D object.
     */
    setTransformation(transformation) {
        super.setTransformation(transformation)
        this.obj3d.setTransformation(this.world_transformation)
    }

    /**
     * Renders the 3D object.
     */
    render(gl) {
        this.obj3d.render(gl)
        super.render(gl)
    }
}

export {
    Scene,
    SceneNode
}
