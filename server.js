var port = process.env.PORT || 8080;        // set our port
var express    = require('express');        // call express
var server        = express();                 // define our app using express
var clone = require('clone');
var spawn = require('child_process').spawn;
var spawnargs = require('spawn-args');
var config = require('./config');

process.exists = function(pid) {
  try {
      return process.kill(pid,0);
  }
  catch (e) {
    return e.code === 'EPERM';
  }
}

server.use(express.static('public'));

var actions = config.open();
actions.load();

var tasks = [];
var queues = [];
var history = [];

function task_enqueue(appdata) {
    queues.push(appdata);  
    return queues.length;  
}

function task_exit(task, code, signal) {
    if (!task)
        return;
    task.running = false;
    task.finished_time = Date.now();
    task.finished = true;
    task.exit_code = code;
    task.exit_signal = signal;
    console.log( `${task.name} (${task.pid}) #${task.id} finished! ${code} ${signal}`);    
}

function task_terminate(task_id) {
    for (var i = 0; i < tasks.length; i++) {
        var task = tasks[i];
        if (task.id == task_id) {
            task.terminate = true;
            process.kill(task.pid);          
            return true;
        }    
    }
    return false;
}

function task_start(appdata) {
    var task = {};          
    var args = appdata.args;  
    if (args) {       
        for(var vname in appdata.params) {
            args = args.replace('$' + vname, appdata.params[vname]);
        }
    }
    var sargs = spawnargs(args);
    console.log(sargs);
  
    var child = spawn(appdata.command, sargs, { silent: false, detached: false, env: process.env });
  
    task.id = parseInt((Date.now() - 1396622684000) / 100);
    task.pid = child.pid;
    task.name = appdata.name;
    task.data = '';
    task.start_time = Date.now();
    task.command = appdata.command;
    task.args = args;
  
    if (child.stdout) {
        child.stdout.on('data', function(data) {
            task.data += data; 
            //console.log(data);
        });
        child.stderr.on('data', function(data) {
            task.data += data; 
            //console.log(data);
        });  
    }


    child.on('message', function(data) {
        task.data += data; 
        console.log(data);
    });

    child.on('error', function(err) {        
    });
  
    child.on('close', function(code, signal) {
        task_exit(task, code, signal);
    });
  
    task.child = child;
    tasks.push(task);
  
    console.log(`${task.name} (${task.pid}) #${task.id} start!.`);
    return task;
}

function task_execute() {
    try
    {
        for (var i = tasks.length - 1; i >= 0; i--) {
            if (tasks[i].hasOwnProperty('finished')) {
                history.push(tasks[i]);
                tasks.splice(i, 1);              
            }
        }
      
        if (queues.length > 0) {  
            var appdata = queues[0];
            if (appdata)
            {              
                var instances = 0;
                for (var i = 0; i < tasks.length; i++) {              
                    if ((tasks[i].name == appdata.name) && (!tasks[i].finished))
                        instances++;
                }

                if ((!appdata.limit) || (instances < appdata.limit)) {
                    queues.shift();
                    task_start(appdata);                  
                }
                /* else {
                    console.log(`${appdata.name} limit reach ${appdata.limit}`);
                } */
            } else {
                queues.shift();
            }
        }
    }  
    catch(err)
    {
        console.error('task_execute error:', err);
    }
    setTimeout(task_execute, 1000);
}

task_execute();



// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
server.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });   
});

server.get('/run/:name', function(req, res) {
    var name = req.params.name;
    var results = { success: 0 };
    if (name) {
        var data = clone( actions.data[name] );
        var params = req.query;
        if (data) {
            data.name = name;
            data.params = params;
          
            var qid = task_enqueue(data);
            if (qid)
                results = {success: 1, qid: qid };
        }        
        //res.json({ name: req.params.name });
    }
    res.json(results);
    res.end();
});

server.get('/kill/:tid', function(req, res) {
    var tid = req.params.tid;
    var results = { success: 0 };
    if (tid) {
        if (task_terminate(tid)) {
          
            results = { success: 1 };
        }
        else
            results = { success: 0, message: 'Invalid task id.'};
    }
    res.json(results);
    res.end();
});

server.get('/queues', function(req, res) {  
    res.setHeader('content-type', 'text/plain');
    res.send( actions.getJSON(queues) );
    res.end();  
});

server.get('/running', function(req, res) {
    res.setHeader('content-type', 'text/plain');
    res.send( actions.getJSON(tasks) );
    res.end();
});

server.get('/history', function(req, res) {  
    res.setHeader('content-type', 'text/plain');
    res.send( actions.getJSON(history) );
    res.end();  
});

server.get('/history/clear', function(req, res) {  
    res.setHeader('content-type', 'text/plain');
    res.json({ success: 1 });
    res.end();  
});

server.get('/reload', function(req, res) {
    var results = {};
    res.setHeader('content-type', 'text/plain');
  
    if (tasks.length == 0) {
        actions.load();
        console.log('Reload configs.');
        results = { success: 1 };
    } else {
        results = { success: 0, message: 'Task is running.'};
    }
    res.json(results);
    res.end();  
});


// START THE SERVER
// =============================================================================
server.listen(port);
console.log('Tasks control on port ' + port);
