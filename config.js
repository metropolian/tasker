/* Config File Manager */

var config_fname = 'config.json';
var config_fs = require('fs');

module.exports = {
    
    get_fs: function () {
        return require('fs');        
    },
    
    
    get_version: function () {
        return 1.0;
    },
  
    open: function(fname, fs) {      
        if (!fname)
            fname = config_fname;      
        if (!fs)
            fs = config_fs;
      
        this.filename = fname;
        return {
          
            load: function() {
                  if (!fs.existsSync(fname))
                      return {};
                  var raw = fs.readFileSync(fname, 'utf8');
                  return this.data = JSON.parse(raw);
            },
          
            save: function() {
                  return fs.writeFileSync(fname, this.getJSON(data), { flag: 'w' });
            },
          
            getJSON: function (value) {
                  var cache = [];
                  var res = JSON.stringify(value, function(key, value) {
                      if (typeof value === 'object' && value !== null) {
                          if (cache.indexOf(value) !== -1) {
                              // Circular reference found, discard key
                              return;
                          }
                          // Store value in our collection
                          cache.push(value);
                      }
                      return value;
                  }, 4);
                  cache = null
                  return res;
             },
          
             toString: function () {
                  return this.getJSON(this.data);
             }
          
          
            
        }
    }

};

