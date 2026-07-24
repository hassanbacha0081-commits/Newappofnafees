import React, { forwardRef, useState, useEffect } from 'react';
import { translations, type Language } from '../translations';
import { db } from '../db';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

