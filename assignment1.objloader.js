import { loadExternalFile } from './js/utils/utils.js'

/**
 * A class to load and parse OBJ files.
 */
class OBJLoader {

    /**
     * Sets up the loader with the given file path.
     * 
     * @param {String} filename The path to the OBJ file.
     */
    constructor(filename) {
        this.filename = filename
    }

    /**
     * Reads the file and extracts the vertices and face indices.
     * 
     * @returns {[Array<Number>, Array<Number>]} A list with vertices and triangle indices.
     */
    load() {
        // Load the file content.
        let contents = loadExternalFile(this.filename)

        // Store vertices and face indices.
        let vertices = []
        let indices = []

        // Break the content into lines.
        let lines = contents.split('\n')

        // Track min/max values to normalize the model.
        let minExtent = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE]
        let maxExtent = [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE]

        // Go through each line in the file.
        for (let line of lines) {
            line = line.trim()
            if (line.startsWith('v ')) {
                // Process a vertex line.
                let vertex = this.parseVertex(line)
                vertices.push(vertex)

                // Update min/max values.
                for (let i = 0; i < 3; i++) {
                    minExtent[i] = Math.min(minExtent[i], vertex[i])
                    maxExtent[i] = Math.max(maxExtent[i], vertex[i])
                }
            } else if (line.startsWith('f ')) {
                // Process a face line.
                let faceIndices = this.parseFace(line)
                indices.push(...faceIndices)
            }
        }

        // Normalize the vertices to fit within a range.
        let scale = 2.0 / Math.max(
            maxExtent[0] - minExtent[0], 
            maxExtent[1] - minExtent[1], 
            maxExtent[2] - minExtent[2]
        )
        let offset = [
            -(maxExtent[0] + minExtent[0]) / 2,
            -(maxExtent[1] + minExtent[1]) / 2,
            -(maxExtent[2] + minExtent[2]) / 2,
        ]

        for (let i = 0; i < vertices.length; i++) {
            for (let j = 0; j < 3; j++) {
                vertices[i][j] = (vertices[i][j] + offset[j]) * scale
            }
        }

        // Return the final vertices and indices.
        return [vertices.flat(), indices]
    }

    /**
     * Reads a vertex line and returns its coordinates.
     * 
     * @param {String} vertex_string A vertex line like 'v x y z'.
     * @returns {Array<Number>} The x, y, z coordinates as an array.
     */
    parseVertex(vertex_string) {
        let parts = vertex_string.split(/\s+/)
        let x = parseFloat(parts[1])
        let y = parseFloat(parts[2])
        let z = parseFloat(parts[3])
        return [x, y, z]
    }

    /**
     * Reads a face line and returns the indices.
     * 
     * @param {String} face_string A face line like 'f v0/vt0/vn0 v1/vt1/vn1 v2/vt2/vn2'.
     * @returns {Array<Number>} A list of three indices for a triangle.
     */
    parseFace(face_string) {
        let parts = face_string.split(/\s+/).slice(1) // Skip 'f'.

        // Get the first number from each section (vertex index).
        let indices = parts.map(part => parseInt(part.split('/')[0]) - 1)

        if (indices.length === 3) {
            // Return triangle indices.
            return indices
        } else if (indices.length === 4) {
            // Convert a quad to two triangles.
            return this.triangulateFace(indices)
        }

        throw "Unsupported face format"
    }

    /**
     * Converts a quad into two triangles.
     * 
     * @param {Array<Number>} face A list with four indices.
     * @returns {Array<Number>} Two sets of three indices for the triangles.
     */
    triangulateFace(face) {
        return [face[0], face[1], face[2], face[0], face[2], face[3]]
    }
}

export {
    OBJLoader
}
