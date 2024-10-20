import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import * as tf from '@tensorflow/tfjs';

interface OcrResult {
  materia: string;
  notas: { [key: string]: string };
}

const DigitalizationAssistant: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('Componente inicializado');
  const [zoom, setZoom] = useState(1);

  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
        setDebugInfo(prev => prev + '\nImagen cargada correctamente');
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg');
    });
  };

  const parseOcrResult = (text: string): OcrResult[] => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const results: OcrResult[] = [];
    let currentMateria: string | null = null;
    let currentNotas: { [key: string]: string } = {};

    lines.forEach(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1];
        if (isNaN(Number(lastPart))) {
          // Si la última parte no es un número, asumimos que es el nombre de una materia
          if (currentMateria) {
            results.push({ materia: currentMateria, notas: currentNotas });
          }
          currentMateria = line.trim();
          currentNotas = {};
        } else {
          // Si la última parte es un número, asumimos que es una nota
          const notaKey = parts.slice(0, -1).join(' ');
          currentNotas[notaKey] = lastPart;
        }
      }
    });

    // Añadir la última materia
    if (currentMateria) {
      results.push({ materia: currentMateria, notas: currentNotas });
    }

    return results;
  };

  const handleUpload = useCallback(async () => {
    if (!imgRef.current || !completedCrop) {
      setDebugInfo(prev => prev + '\nNo se ha seleccionado ninguna área de la imagen');
      return;
    }

    setUploading(true);
    setDebugInfo(prev => prev + '\nIniciando proceso de OCR...');

    try {
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
      
      if (!workerRef.current) {
        workerRef.current = await createWorker('spa');
      }

      setDebugInfo(prev => prev + '\nWorker de Tesseract creado');

      const result = await workerRef.current.recognize(croppedImageBlob);
      
      setDebugInfo(prev => prev + '\nOCR completado');

      const parsedResults = parseOcrResult(result.data.text);
      setOcrResults(parsedResults);
      setDebugInfo(prev => prev + '\nProceso de OCR y post-procesamiento completado');
    } catch (error) {
      console.error('Error en el proceso de OCR:', error);
      setDebugInfo(prev => prev + `\nError: ${error}`);
    } finally {
      setUploading(false);
    }
  }, [completedCrop]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.1));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Asistente de Digitalización y OCR</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecciona la imagen a digitalizar y procesar con OCR
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      {imagePreview && (
        <div className="mb-4">
          <div className="flex justify-center mb-2">
            <button onClick={handleZoomOut} className="mr-2"><ZoomOut /></button>
            <button onClick={handleZoomIn}><ZoomIn /></button>
          </div>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            <img
              ref={imgRef}
              src={imagePreview}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              alt="Preview"
            />
          </ReactCrop>
        </div>
      )}
      <button
        onClick={handleUpload}
        disabled={!completedCrop || uploading}
        className={`w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center mb-4`}
      >
        {uploading ? (
          <>
            <Upload className="animate-spin mr-2" size={20} />
            Procesando...
          </>
        ) : (
          <>
            <Upload className="mr-2" size={20} />
            Digitalizar y Procesar OCR
          </>
        )}
      </button>
      {ocrResults.length > 0 && (
        <div className="overflow-x-auto">
          <h3 className="text-lg font-semibold mb-2">Resultados del OCR:</h3>
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border-b">Materia</th>
                {Object.keys(ocrResults[0].notas).map((key, index) => (
                  <th key={index} className="py-2 px-4 border-b">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ocrResults.map((result, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="py-2 px-4 border-b">{result.materia}</td>
                  {Object.values(result.notas).map((nota, notaIndex) => (
                    <td key={notaIndex} className="py-2 px-4 border-b">{nota}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 p-2 bg-gray-100 rounded">
        <h4 className="font-semibold">Información de depuración:</h4>
        <pre className="text-xs whitespace-pre-wrap">{debugInfo}</pre>
      </div>
    </div>
  );
};

export default DigitalizationAssistant;