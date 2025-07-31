import * as faceapi from 'face-api.js';
import type { Employee } from './types';

// Loading the models concurrently
export const loadModels = async () => {
  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
};

export const isFaceDetectionModelLoaded = () => {
    return !!faceapi.nets.tinyFaceDetector.params;
};

export const getFullFaceDescription = async (blob: Blob | HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, inputSize = 512) => {
  // Using tinyFaceDetector for faster detection
  const scoreThreshold = 0.5;
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
  
  // Detect a single face and compute landmarks and descriptor
  const fullDesc = await faceapi.detectSingleFace(blob, options)
    .withFaceLandmarks(true) // Using true for tiny landmark model
    .withFaceDescriptor();

  return fullDesc;
};

// This function creates a FaceMatcher instance that can be used to recognize faces.
// It takes an array of employee data, where each employee has a photo.
export const createMatcher = async (employeesWithPhotos: Employee[]) => {
  if (employeesWithPhotos.length === 0) {
    return null;
  }
  
  const labeledFaceDescriptors = await Promise.all(
    employeesWithPhotos.map(async (employee) => {
      if (!employee.photoDataUri) return null;

      try {
        // Each employee photo needs to be converted into a face descriptor
        const img = await faceapi.fetchImage(employee.photoDataUri);
        const fullFaceDescription = await getFullFaceDescription(img);
        
        if (!fullFaceDescription) {
          console.error(`Could not find face in photo for ${employee.name}`);
          return null;
        }
        
        // We associate the face descriptor with the employee's ID
        return new faceapi.LabeledFaceDescriptors(
          employee.id,
          [fullFaceDescription.descriptor]
        );
      } catch(error) {
        console.error(`Error processing image for ${employee.name}:`, error);
        return null;
      }
    })
  );

  // Filter out any null values (for employees where face detection failed)
  const validDescriptors = labeledFaceDescriptors.filter(d => d !== null) as faceapi.LabeledFaceDescriptors[];

  if(validDescriptors.length === 0){
      return null;
  }

  // The FaceMatcher will compare a new face to this list of known faces
  const maxDescriptorDistance = 0.6; // Threshold for considering a match
  return new faceapi.FaceMatcher(validDescriptors, maxDescriptorDistance);
};
