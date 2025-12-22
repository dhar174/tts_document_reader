import { DriveFile } from "../types";

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export async function initGoogleScripts(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // If already initialized, just return
    if (gapiInited && gisInited && tokenClient) {
        resolve();
        return;
    }

    // Load GAPI
    const loadGapi = () => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiInited = true;
          checkComplete();
        } catch (err) {
          reject(err);
        }
      });
    };

    // Load GIS
    const loadGis = () => {
      try {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: '', // defined at request time
        });
        gisInited = true;
        checkComplete();
      } catch (err) {
        reject(err);
      }
    };

    const checkComplete = () => {
      if (gapiInited && gisInited) {
        resolve();
      }
    };

    if (window.gapi) loadGapi();
    else reject(new Error("Google API script not loaded"));

    if (window.google) loadGis();
    else reject(new Error("Google Identity script not loaded"));
  });
}

export async function authenticate(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("Token client not initialized"));

    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
      }
      resolve();
    };

    // Request access token, skipping prompt if possible for repeat users
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export async function listGoogleDocs(): Promise<DriveFile[]> {
  try {
    const response = await window.gapi.client.drive.files.list({
      'pageSize': 20,
      'fields': 'files(id, name, mimeType, modifiedTime, iconLink, thumbnailLink)',
      // Filter for Google Docs and text files only
      'q': "mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain'",
      'orderBy': 'modifiedTime desc'
    });
    return response.result.files || [];
  } catch (err) {
    console.error("Error listing files", err);
    throw err;
  }
}

export async function getFileContent(fileId: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      // Export Google Docs to plain text
      const response = await window.gapi.client.drive.files.export({
        fileId: fileId,
        mimeType: 'text/plain',
      });
      return response.body;
    } else {
      // Get content of plain text files
      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });
      return response.body;
    }
  } catch (err) {
    console.error("Error getting file content", err);
    throw err;
  }
}
