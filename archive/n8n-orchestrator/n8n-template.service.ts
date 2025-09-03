import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';

@Injectable()
export class N8nTemplateService {
  /**
   * Parses a template object and replaces placeholders with dynamic values.
   * Placeholders should be in the format {{VARIABLE_NAME}}.
   *
   * @param template The template object to parse.
   * @param variables A key-value map of variables to inject.
   * @returns A new object with all placeholders replaced.
   */
  parseTemplate<T>(template: T, variables: Record<string, any>): T {
    // Deep clone the template to avoid modifying the original object
    const parsedTemplate = _.cloneDeep(template);

    const replacer = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          replacer(obj[key]);
        } else if (typeof obj[key] === 'string') {
          // Match placeholders like {{VAR_NAME}}
          const match = obj[key].match(/^{{(.*)}}$/);
          if (match && variables.hasOwnProperty(match[1])) {
            obj[key] = variables[match[1]];
          }
        }
      }
    };

    replacer(parsedTemplate);
    return parsedTemplate;
  }
}
