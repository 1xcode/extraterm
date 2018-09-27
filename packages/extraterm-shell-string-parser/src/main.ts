/*
 * Copyright 2018 Nick Shanny <nshanny@mac.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Parse an argument string into an array of args following these simple rules:
 * 
 * Split spaces into an array, and supporting double and single quotes and nothing else, just the minimum. 
 * Then people can quote their strings which contain spaces and it will mostly work as they expect.
 *
 * @return string[] of arguments.
 */

export function shell_string_parser(args: string): string[] {
  const arr: string[] = [];
  let quote = false;  // true means we're inside a quoted field

  let c: number;
  // iterate over each character, keep track of current field index (i)
  for (let i = c = 0; c < args.length; c++) {
      const cc = args[c];     // current character
      const nc = args[c+1];   // next character
      arr[i] = arr[i] || '';           // create a new array value (start with empty string) if necessary

      // If it's just one quotation mark, begin/end quoted field
      if (cc == '"' || cc == '\'') { 
        quote = !quote; 
        continue; 
      }

      // If it's a space, and we're not in a quoted field, move on to the next field
      if (cc == ' ' && !quote) { 
        ++i; 
        continue; 
      }

      // Otherwise, append the current character to the current field
      arr[i] += cc;
  }

  return arr;
}
