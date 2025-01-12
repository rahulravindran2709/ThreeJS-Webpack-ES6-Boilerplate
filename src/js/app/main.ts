// Global imports -
import TWEEN from "@tweenjs/tween.js";
import * as THREE from "three";
// data
import Config from "../data/config";
import Camera from "./components/camera";
import Controls from "./components/controls";
import Geometry from "./components/geometry";
import Light from "./components/light";
import Material from "./components/material";
import { Physics } from "./components/physics";
// Local imports -
// Components
import Renderer from "./components/renderer";
import Interaction from "./managers/interaction";
// Model
import Texture from "./model/texture";

// -- End of imports
let directions;
// This class instantiates and ties all of the components together, starts the loading process and renders the main loop
export default class Main {
  container;
  clock;
  scene;
  mazeDimension;
  renderer;
  camera;
  texture;
  maze: Array<Array<boolean>>;
  material;
  geometry;
  controls;
  gameState;
  lights;
  physics;
  ballMesh: THREE.Mesh;
  path: Array<Array<number>> = [];
  constructor(container: HTMLElement) {
    // Set container property to container element
    this.container = container;

    // Start Three clock
    this.clock = new THREE.Clock();
    this.mazeDimension = 11;
    // Main scene creation
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(Config.fog.color, Config.fog.near);
    this.material = new Material();
    this.geometry = new Geometry(this.scene, this.mazeDimension);

    // Get Device Pixel Ratio first for retina
    if (window.devicePixelRatio) {
      Config.dpr = window.devicePixelRatio;
    }

    // Main renderer constructor
    this.renderer = new Renderer(this.scene, container);
    //Instantiate camera
    this.camera = new Camera(this.renderer.threeRenderer);

    //Adding orbit controls
    this.controls = new Controls(this.camera.threeCamera, container);
    //Instantiate lights
    this.lights = new Light(this.scene);
    // Instantiate texture class
    this.texture = new Texture();

    //Instantiate the physics

    this.physics = new Physics();
    this.maze = this.generateSquareMaze(this.mazeDimension);
    this.maze[this.mazeDimension - 1][this.mazeDimension - 2] = false;

    this.setupPhysics();
    // Start loading the textures and then go on to load the model after the texture Promises have resolved
    this.texture.load().then(() => {
      this.setupRenderWorld();

      console.log("ballmesh", this.ballMesh);
      this.gameState = "fade in";
      new Interaction(
        this.renderer.threeRenderer,
        this.scene,
        this.camera.threeCamera,
        this.controls.threeControls,
        this.moveBall.bind(this)
      );
      // this.lights.pointLight.intensity = 0;
    });
    this.gameState = "initialize";
    // Start render which does not wait for model fully loaded
    this.render(Date.now());
  }
  moveBall(direction: "left" | "right" | "up" | "down") {
    this.physics.moveBall(direction);
  }
  setupRenderWorld() {
    // Adding camera to the scene
    this.scene.add(this.camera.threeCamera);

    // Adding lights to scene
    this.lights.place("ambient");
    this.lights.place("point");
    const ball = this.geometry.makeBall();
    const groundGeometry = this.geometry.makeGround();
    const wallGeometry = this.geometry.makeWalls(this.maze);
    const {
      grass: groundTexture,
      ball: ballTexture,
      wall: brickTexture,
    } = this.texture.textures;
    const ballMaterial = this.material.makePhongMaterial(ballTexture);
    this.ballMesh = new THREE.Mesh(ball, ballMaterial);
    console.log('Here!!');
    this.ballMesh.position.set(1, 1, 0.25);
    //Adding ball to scene
    this.scene.add(this.ballMesh);
    const boxMaterial = this.material.makePhongMaterial(brickTexture);
    const mergedMesh = new THREE.Mesh(wallGeometry, boxMaterial);
    mergedMesh.position.z = 0.5;
    //Adding wall to scene
    this.scene.add(mergedMesh);
    //Add ground texture and create ground mesh
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(this.mazeDimension * 5, this.mazeDimension * 5);
    const groundMaterial = this.material.makePhongMaterial(groundTexture);
    const planeMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    planeMesh.position.set(
      (this.mazeDimension - 1) / 2,
      (this.mazeDimension - 1) / 2,
      0
    );
    planeMesh.rotation.set(0, 0, 0);
    //Adding ground to scene
    this.scene.add(planeMesh);
  }
  updateRenderWorld() {
    this.ballMesh.position.copy(
      (this.physics.ball.position as unknown) as THREE.Vector3
    );
    this.ballMesh.quaternion.copy(
      (this.physics.ball.quaternion as unknown) as THREE.Quaternion
    );
    this.lights.pointLight.position.copy(
      new THREE.Vector3(
        this.physics.ball.position.x,
        this.physics.ball.position.y,
        Config.pointLight.z
      )
    );
    //jlee take a look at this
    this.camera.threeCamera.position.x += (this.ballMesh.position.x - this.camera.threeCamera.position.x) * 0.1;
    this.camera.threeCamera.position.y += (this.ballMesh.position.y - this.camera.threeCamera.position.y) * 0.1;
    //this.camera.threeCamera.position.z += (5 - this.camera.threeCamera.position.z) * 0.1;

  }
  setupPhysics() {
    this.physics.setupWorld(this.maze);
  }
  generateSquareMaze(dimension: number) {
    function iterate(field: Array<Array<boolean>>, x: number, y: number) {
      field[x][y] = false;
      while (true) {
        directions = [];
        if (x > 1 && field[x - 2][y] == true) {
          directions.push([-1, 0]);
        }
        if (x < dimension - 2 && field[x + 2][y] == true) {
          directions.push([1, 0]);
        }
        if (y > 1 && field[x][y - 2] == true) {
          directions.push([0, -1]);
        }
        if (y < dimension - 2 && field[x][y + 2] == true) {
          directions.push([0, 1]);
        }
        if (directions.length == 0) {
          return field;
        }
        const dir = directions[Math.floor(Math.random() * directions.length)];
        field[x + dir[0]][y + dir[1]] = false;
        field = iterate(field, x + dir[0] * 2, y + dir[1] * 2);
      }
    }

    // Initialize the field.
    var field = new Array(dimension);
    for (var i = 0; i < dimension; i++) {
      field[i] = new Array(dimension);
      for (var j = 0; j < dimension; j++) {
        field[i][j] = true;
      }
    }
    // Gnerate the maze recursively.
    field = iterate(field, 1, 1);
    return field;
  }
  render(time: number) {
    TWEEN.update();
    switch (this.gameState) {
      case "initialize": {
        console.log('initialzing');
        // this.gameState = "fade in";
        this.lights.pointLight.intensity = 0;
        break;
      }
      case "fade in": {
        console.log('fade in');
        const pointLightIntensity = this.lights.pointLight.intensity;
        this.lights.pointLight.intensity += 0.1 * (1.0 - pointLightIntensity);
        this.renderer.render(this.scene, this.camera.threeCamera);
        if (Math.abs(pointLightIntensity - 1.0) < 0.05) {
          this.lights.pointLight.intensity = 1.0;
          this.gameState = "play";
        }

        break;
      }
      case "play": {
        // console.log('play');
        this.physics.updatePhysics(time);
        this.updateRenderWorld();
        const mazeX = Math.floor(this.ballMesh.position.x + 0.5);
        const mazeY = Math.floor(this.ballMesh.position.y + 0.5);
        //Keep saving the current coordinate to the path
        if (this.path.length === 0) {
          this.path.push([mazeX, mazeY]);
        } else if (this.path[this.path.length - 1]) {
          const [lastX, lastY] = this.path[this.path.length - 1];

          if (lastX !== mazeX || lastY !== mazeY) {
            this.path.push([mazeX, mazeY]);
          }
        }
        //Check if victory was attained
        if (mazeX == this.mazeDimension && mazeY == this.mazeDimension - 2) {
          //mazeDimension += 2;
          (document.getElementById("maze_solution") as HTMLInputElement).value = JSON.stringify(this.path);
          this.gameState = "fade out";
          setTimeout(() => {
            document.forms[0].submit();
          }, 300);
        }

        this.renderer.render(this.scene, this.camera.threeCamera);
        break;
      }
      case "fade out":
      //updatePhysicsWorld();
      //updateRenderWorld();
      this.lights.pointLight.intensity += 0.1 * (0.0 - this.lights.pointLight.intensity);
      this.renderer.render(this.scene, this.camera.threeCamera);
      if (Math.abs(this.lights.pointLight.intensity - 0.0) < 0.1) {
        this.lights.pointLight.intensity = 0.0;
        this.renderer.render(this.scene, this.camera.threeCamera);
        //gameState = "initialize";
      }
      break;
    }
    //this.controls.threeControls.update();

    // RAF
    requestAnimationFrame(this.render.bind(this)); // Bind the main class instead of window object
  }
}
