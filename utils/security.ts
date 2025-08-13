
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core'
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common'

const options = {
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
}

zxcvbnOptions.setOptions(options)

export interface PasswordStrength {
    score: 0 | 1 | 2 | 3 | 4;
    feedback: {
        warning: string;
        suggestions: string[];
    }
}

export const checkPasswordStrength = (password: string): PasswordStrength => {
    if (!password) {
        return {
            score: 0,
            feedback: { warning: '', suggestions: [] },
        };
    }
    const result = zxcvbn(password);
    return {
        score: result.score,
        feedback: result.feedback,
    };
};