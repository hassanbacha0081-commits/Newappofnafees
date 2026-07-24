import React, { forwardRef, useState, useEffect } from 'react';
import { translations, type Language } from '../translations';
import { db } from '../db';
import jsPDF from 'jspdf';
import { html2canvasWithOklch as html2canvas } from '../lib/html2canvas-helper';

